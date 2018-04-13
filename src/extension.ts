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

function findRootPath(uri: vscode.Uri): string | undefined {
    if (!vscode.workspace.workspaceFolders) {
        return undefined;
    }

    for (let entry of vscode.workspace.workspaceFolders) {
        const p = path.normalize(path.relative(entry.uri.fsPath, uri.fsPath));

        if (p.substring(0, 2) != "..") {
            return entry.uri.fsPath;
        }
    }

    return undefined;
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

        const disposable = vscode.workspace.onDidSaveTextDocument(e => {
            var line = "";
            var hasError = false;

            var updates: {[key: string]: vscode.Diagnostic[]} = {};

            // TODO: setup diagnostics.
            var message = function(data: any) {
                if (data["type"] != "diagnostics") {
                    return;
                }

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

            const rootPath = findRootPath(e.uri);

            // do nothing
            if (!rootPath) {
                vscode.window.showErrorMessage(`could not find a workspace folder for path: ${e.uri}`);
                return;
            }

            // no build nanifest in root path.
            if (!fs.existsSync(path.join(rootPath, "reproto.toml"))) {
                return;
            }

            const child = spawn(reproto, ["--output-format", "json", "build"], {
                cwd: rootPath
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
                out.append(data.toString());
            });

            child.on('exit', e => {
                diagnostics.clear();

                // can only show diagnostics _if_ we have a root path.
                for (var k in updates) {
                    const p = path.join(rootPath, k);
                    const uri = vscode.Uri.file(p);
                    diagnostics.set(uri, updates[k]);
                }

                if (hasError) {
                    out.show();
                }
            });
        });

        context.subscriptions.push(diagnostics);
        context.subscriptions.push(disposable);

        vscode.window.showInformationMessage(`reproto found: ${reproto}`);
    } else {
        vscode.window.showErrorMessage("reproto command could not be found (see console)");

        out.appendLine("reproto command could not be found, we looked in the following places:");

        displays.forEach((d, i)  => {
            out.appendLine(`#${i}: ${d}`);
        });

        out.show(true);
    }

    context.subscriptions.push(out);
}

// this method is called when your extension is deactivated
export function deactivate() {
}