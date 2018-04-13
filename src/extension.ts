'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface Range {
    line_start: number;
    col_start: number;
    line_end: number;
    col_end: number;
}

enum ReprotoSymbolKind {
    Type = "type",
    Interface = "interface",
    Enum = "Enum",
    Tuple = "tuple",
    Service = "service"
}

interface ReprotoSymbol {
    kind: ReprotoSymbolKind;
    name: string;
    package: string;
    path: string;
    range: Range;
}

function detectCandidates(): [string[], string[]] {
    const config = vscode.workspace.getConfiguration("reproto");

    const displays: string[] = [];
    const candidates: string[] = [];

    const executable = config.get<string>("executable");

    if (executable) {
        displays.push("reproto.executable (user configuration)");
        candidates.push(executable);
    } else {
        displays.push("reproto.executable (user configuration) is not defined");
    }

    if (process.env.REPROTO_HOME) {
        displays.push("$REPROTO_HOME/.reproto/bin/reproto");
        candidates.push(path.join(process.env.REPROTO_HOME), "bin", "reproto");
    } else {
        displays.push("$REPROTO_HOME is not defined");
    }

    if (process.env.HOME) {
        displays.push("$HOME/.reproto/bin/reproto");
        candidates.push(path.join(process.env.HOME, ".reproto", "bin", "reproto"));
    } else {
        displays.push("$HOME is not defined");
    }

    if (process.env.PATH) {
        displays.push("$PATH");

        process.env.PATH.split(path.delimiter).forEach((p: string) => {
            candidates.push(path.join(p, "reproto"));
        });
    } else {
        displays.push("$PATH is not defined");
    }

    return [displays, candidates];
}

function detectReproto(candidates: string[]): string | undefined {
    for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];

        if (c && fs.existsSync(c)) {
            return c;
        }
    }

    return undefined;
}

class ReprotoReferenceProvider implements vscode.ReferenceProvider {
    provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Location[]> {
        return [];
    }
}

class ReprotoTypeDefinitionProvider implements vscode.TypeDefinitionProvider {
    provideTypeDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition> {
        return null;
    }
}

class ReprotoSymbolProvider implements vscode.DocumentSymbolProvider, vscode.WorkspaceSymbolProvider {
    symbols: { [key: string]: vscode.SymbolInformation[] };
    byUri: { [key: string]: vscode.SymbolInformation[] };

    constructor() {
        this.symbols = {};
        this.byUri = {};
    }

    provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.SymbolInformation[]> {
        return this.byUri[document.uri.toString()] || [];
    }

    provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[]> {
        let out: vscode.SymbolInformation[] = [];

        const q = query.toLowerCase();

        for (let k in this.symbols) {
            for (let s of this.symbols[k]) {
                if (s.name.toLowerCase().indexOf(q) != -1) {
                    out.push(s);
                    continue;
                }
            }
        }

        return out;
    }
}

class ReprotoBuilder {
    reproto: string;
    symbolProvider: ReprotoSymbolProvider;
    out: vscode.OutputChannel;
    diagnostics: vscode.DiagnosticCollection;

    constructor(
        reproto: string,
        symbolProvider: ReprotoSymbolProvider,
        out: vscode.OutputChannel,
        diagnostics: vscode.DiagnosticCollection,
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
    rebuild(uri: vscode.Uri) {
        let ext = path.extname(uri.fsPath);

        if (ext != ".reproto") {
            return;
        }

        const rootPath = vscode.workspace.getWorkspaceFolder(uri);

        // do nothing
        if (!rootPath) {
            return;
        }

        this.buildWorkspace(rootPath);
    }

    buildWorkspace(rootPath: vscode.WorkspaceFolder) {
        // no build nanifest in root path.
        if (!fs.existsSync(path.join(rootPath.uri.fsPath, "reproto.toml"))) {
            return;
        }

        var line = "";
        var hasError = false;

        var updates: { [key: string]: vscode.Diagnostic[] } = {};
        var symbolUpdates: vscode.SymbolInformation[] = [];
        var symbolUpdatesByUri: { [key: string]: vscode.SymbolInformation[] } = {};

        var handleDiagnostics = function (data: any) {
            const raw = data["range"] as Range;

            const start = new vscode.Position(raw.line_start, raw.col_start);
            const end = new vscode.Position(raw.line_end, raw.col_end);
            const range = new vscode.Range(start, end);
            const d = new vscode.Diagnostic(range, data.message, vscode.DiagnosticSeverity.Error);

            if (!updates[data.path]) {
                updates[data.path] = [d];
            } else {
                updates[data.path].push(d);
            }
        }

        var handleSymbol = function (data: ReprotoSymbol) {
            let uri = vscode.Uri.file(data.path);

            let start = new vscode.Position(data.range.line_start, data.range.col_start);
            let end = new vscode.Position(data.range.line_end, data.range.col_end);
            let range = new vscode.Range(start, end);
            let location = new vscode.Location(uri, range);

            let type = vscode.SymbolKind.Constant;

            switch (data.kind) {
                case ReprotoSymbolKind.Type:
                    type = vscode.SymbolKind.Class
                    break;
                case ReprotoSymbolKind.Interface:
                    type = vscode.SymbolKind.Interface
                    break;
                case ReprotoSymbolKind.Enum:
                    type = vscode.SymbolKind.Enum
                    break;
                case ReprotoSymbolKind.Tuple:
                    type = vscode.SymbolKind.Array
                    break;
                case ReprotoSymbolKind.Service:
                    type = vscode.SymbolKind.Class
                    break;
                default:
                    break;
            }

            let info = new vscode.SymbolInformation(
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

        const child = spawn(this.reproto, ["--output-format", "json", "build"], {
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

            // can only show diagnostics _if_ we have a root path.
            for (var k in updates) {
                const uri = vscode.Uri.file(path.join(rootPath.uri.fsPath, k));
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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const [displays, candidates] = detectCandidates();
    const reproto = detectReproto(candidates);

    const out = vscode.window.createOutputChannel("reproto");

    if (reproto) {
        console.log(`found reproto: ${reproto}`)

        var diagnostics = vscode.languages.createDiagnosticCollection("reproto");

        context.subscriptions.push(
            vscode.languages.registerReferenceProvider(
                "reproto",
                new ReprotoReferenceProvider()));

        context.subscriptions.push(
            vscode.languages.registerTypeDefinitionProvider(
                "reproto",
                new ReprotoTypeDefinitionProvider()));

        var symbolProvider = new ReprotoSymbolProvider();

        context.subscriptions.push(
            vscode.languages.registerDocumentSymbolProvider("reproto",
                symbolProvider));

        context.subscriptions.push(
            vscode.languages.registerWorkspaceSymbolProvider(
                symbolProvider));

        const builder = new ReprotoBuilder(
            reproto,
            symbolProvider,
            out,
            diagnostics
        );

        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e => {
            builder.rebuild(e.uri);
        }));

        // perform initial build
        for (let workspace of vscode.workspace.workspaceFolders || []) {
            builder.buildWorkspace(workspace);
        }

        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(e => {
            builder.rebuild(e.uri);
        }));

        context.subscriptions.push(diagnostics);
        vscode.window.showInformationMessage(`reproto found: ${reproto}`);
    } else {
        vscode.window.showErrorMessage("reproto command could not be found (see console)");

        out.appendLine("reproto command could not be found, we looked in the following places:");

        displays.forEach((d, i) => {
            out.appendLine(`#${i}: ${d}`);
        });

        out.show(true);
    }

    context.subscriptions.push(out);
}

// this method is called when your extension is deactivated
export function deactivate() {
}