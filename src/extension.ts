'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as simple from './reproto_simple';
import * as language_client from './reproto_language_client';

function detectCandidates(config: vscode.WorkspaceConfiguration): [string[], string[]] {
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

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration("reproto");

    const [displays, candidates] = detectCandidates(config);
    const reproto = detectReproto(candidates);

    const out = vscode.window.createOutputChannel("reproto");

    let type = config.get<string>("type");

    if (reproto) {
        console.log(`found reproto: ${reproto}`)
        vscode.window.showInformationMessage(`reproto found: ${reproto}`);

        switch (type) {
            case "language-client":
                language_client.activate(context, reproto, out);
                break;
            case "simple":
            default:
                simple.activate(context, reproto, out);
                break;
        }
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