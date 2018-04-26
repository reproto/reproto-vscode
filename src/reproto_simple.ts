/**
 * A builder implementation that calls the regular build command and captures diagnostics output.
 */
import { workspace, Location, SymbolKind, Position, Range, DiagnosticSeverity, WorkspaceFolder, SymbolInformation, Uri, Diagnostic, OutputChannel, DiagnosticCollection, CancellationToken, ReferenceContext, TextDocument, ReferenceProvider, ProviderResult, DefinitionProvider, TypeDefinitionProvider, Definition, ExtensionContext, languages } from 'vscode';
import { ReprotoSymbolProvider } from './reproto_symbol_provider';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Reproto } from './reproto';

export interface ReprotoRange {
    line_start: number;
    col_start: number;
    line_end: number;
    col_end: number;
}

export enum ReprotoSymbolKind {
    Type = "type",
    Interface = "interface",
    Enum = "Enum",
    Tuple = "tuple",
    Service = "service"
}

export interface ReprotoSymbol {
    kind: ReprotoSymbolKind;
    name: string;
    package: string;
    path: string;
    range: ReprotoRange;
}

export class ReprotoBuilder {
    reproto: Reproto;
    symbolProvider: ReprotoSymbolProvider;
    out: OutputChannel;
    diagnostics: DiagnosticCollection;

    constructor(
        reproto: Reproto,
        symbolProvider: ReprotoSymbolProvider,
        out: OutputChannel,
        diagnostics: DiagnosticCollection,
    ) {
        this.reproto = reproto;
        this.symbolProvider = symbolProvider;
        this.out = out;
        this.diagnostics = diagnostics;
    }

    /**
     * Rebuild the given URI if applicable.
     * 
     * @param uri uri to rebuild
     */
    rebuild(uri: Uri) {
        let ext = path.extname(uri.fsPath);

        if (ext != ".reproto") {
            return;
        }

        const rootPath = workspace.getWorkspaceFolder(uri);

        // do nothing
        if (!rootPath) {
            return;
        }

        this.buildWorkspace(rootPath);
    }

    buildWorkspace(rootPath: WorkspaceFolder) {
        // no build nanifest in root path.
        if (!fs.existsSync(path.join(rootPath.uri.fsPath, "reproto.toml"))) {
            return;
        }

        var line = "";
        var hasError = false;

        var updates: { [key: string]: Diagnostic[] } = {};
        var symbolUpdates: SymbolInformation[] = [];
        var symbolUpdatesByUri: { [key: string]: SymbolInformation[] } = {};

        var handleDiagnostics = function (data: any) {
            const raw = data["range"] as ReprotoRange;

            const start = new Position(raw.line_start, raw.col_start);
            const end = new Position(raw.line_end, raw.col_end);
            const range = new Range(start, end);
            const d = new Diagnostic(range, data.message, DiagnosticSeverity.Error);

            if (!updates[data.path]) {
                updates[data.path] = [d];
            } else {
                updates[data.path].push(d);
            }
        }

        var handleSymbol = function (data: ReprotoSymbol) {
            let uri = Uri.file(data.path);

            let start = new Position(data.range.line_start, data.range.col_start);
            let end = new Position(data.range.line_end, data.range.col_end);
            let range = new Range(start, end);
            let location = new Location(uri, range);

            let type = SymbolKind.Constant;

            switch (data.kind) {
                case ReprotoSymbolKind.Type:
                    type = SymbolKind.Class
                    break;
                case ReprotoSymbolKind.Interface:
                    type = SymbolKind.Interface
                    break;
                case ReprotoSymbolKind.Enum:
                    type = SymbolKind.Enum
                    break;
                case ReprotoSymbolKind.Tuple:
                    type = SymbolKind.Array
                    break;
                case ReprotoSymbolKind.Service:
                    type = SymbolKind.Class
                    break;
                default:
                    break;
            }

            let info = new SymbolInformation(
                data.name,
                type,
                data.package,
                location
            );

            symbolUpdates.push(info);

            let uriKey = info.location.uri.toString();

            if (!symbolUpdatesByUri[uriKey]) {
                symbolUpdatesByUri[uriKey] = [info];
            } else {
                symbolUpdatesByUri[uriKey].push(info);
            }
        }

        // TODO: setup diagnostics.
        var message = function (data: any) {
            if (data["type"] == "diagnostics") {
                handleDiagnostics(data);
                return;
            }

            if (data["type"] == "symbol") {
                handleSymbol(data as ReprotoSymbol);
                return;
            }
        }

        const child = spawn(this.reproto.path, ["--output-format", "json", "build"], {
            cwd: rootPath.uri.fsPath
        });

        child.stdout.on('data', data => {
            line += data.toString();

            while (true) {
                const nl = line.indexOf('\n');

                if (nl < 0) {
                    break;
                }

                const m = JSON.parse(line.substring(0, nl));
                message(m);
                line = line.substring(nl + 1);
            }
        });

        child.stderr.on('data', data => {
            this.out.append(data.toString());
        });

        child.on('exit', (status) => {
            this.diagnostics.clear();

            for (var k in updates) {
                const uri = Uri.file(path.join(rootPath.uri.fsPath, k));
                this.diagnostics.set(uri, updates[k]);
            }

            if (hasError) {
                this.out.show();
            }

            if (status == 0) {
                this.symbolProvider.symbols[rootPath.uri.toString()] = symbolUpdates.map(v => v);

                for (let uriKey in symbolUpdatesByUri) {
                    this.symbolProvider.byUri[uriKey] = symbolUpdatesByUri[uriKey];
                }
            }

            symbolUpdates.length = 0;
        });
    }
}

class ReprotoReferenceProvider implements ReferenceProvider {
    provideReferences(
        document: TextDocument,
        position: Position,
        context: ReferenceContext,
        token: CancellationToken
    ): ProviderResult<Location[]> {
        return [];
    }
}

class ReprotoDefinitionProvider implements DefinitionProvider, TypeDefinitionProvider {
    /// CTRL+click callback.
    provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): ProviderResult<Definition> {
        return null;
    }

    provideTypeDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): ProviderResult<Definition> {
        return null;
    }
}

export function activate(
    cx: ExtensionContext,
    reproto: Reproto,
    out: OutputChannel
) {
    var diagnostics = languages.createDiagnosticCollection("reproto");
    cx.subscriptions.push(diagnostics);

    cx.subscriptions.push(
        languages.registerReferenceProvider(
            "reproto",
            new ReprotoReferenceProvider()));

    let definitionProvider = new ReprotoDefinitionProvider();

    cx.subscriptions.push(
        languages.registerTypeDefinitionProvider(
            "reproto", definitionProvider));

    cx.subscriptions.push(
        languages.registerDefinitionProvider(
            "reproto", definitionProvider));

    var symbolProvider = new ReprotoSymbolProvider();

    cx.subscriptions.push(
        languages.registerDocumentSymbolProvider(
            "reproto", symbolProvider));

    cx.subscriptions.push(
        languages.registerWorkspaceSymbolProvider(
            symbolProvider));

    const builder = new ReprotoBuilder(
        reproto,
        symbolProvider,
        out,
        diagnostics);

    cx.subscriptions.push(
        workspace.onDidSaveTextDocument(e => {
            builder.rebuild(e.uri);
        }));

    languages.registerReferenceProvider

    // perform initial build
    for (let w of workspace.workspaceFolders || []) {
        builder.buildWorkspace(w);
    }

    cx.subscriptions.push(workspace.onDidOpenTextDocument(e => {
        builder.rebuild(e.uri);
    }));
}