'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as simple from './reproto_simple';
import * as language_client from './reproto_language_client';
import { execSync } from 'child_process';

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
        displays.push("$REPROTO_HOME/reproto");
        candidates.push(path.join(process.env.REPROTO_HOME), "reproto");
    } else {
        displays.push("$REPROTO_HOME is not defined");
    }

    if (process.env.HOME) {
        displays.push("$HOME/.local/bin/reproto");
        candidates.push(path.join(process.env.HOME, ".local", "bin", "reproto"));
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

/**
 * Try to determine the version of reproto.
 */
function detectVersion(
    out: vscode.OutputChannel,
    reproto: string
): [number, number, number] | null {
    const command = `${reproto} --version`;

    try {
        var output = execSync(command).toString().trim();

        const p = output.split(/[ \t]+/);

        if (p.length >= 2 && p[0] == "reproto") {
            const c = p[1].split(/[\.-]/);

            if (c.length >= 3) {
                const major = parseInt(c[0]);
                const minor = parseInt(c[1]);
                const patch = parseInt(c[2]);

                out.appendLine(`${reproto}: detected version: major: ${major}, minor: ${minor}, patch: ${patch}`);
                return [major, minor, patch];
            }
        }
    } catch (e) {
        out.appendLine(`failed to detect version: ${command}:`)
        out.appendLine(e.toString());
        out.show(true);
    }

    return null;
}

/**
 * Use detected version to determine which extension typoe to use.
 */
function defaultExtensionType(
    out: vscode.OutputChannel,
    version: [number, number, number] | null,
    defaultType: string,
): string {
    if (!version) {
        out.appendLine(`no version detected, falling back to default extension type: ${defaultType}`);
        out.show(true);
        return defaultType;
    }

    let [major, minor, patch] = version;

    if (major >= 0 && minor >= 3 && patch >= 35) {
        return "language-client";
    }

    return defaultType;
}

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration("reproto");

    const [displays, candidates] = detectCandidates(config);
    const reproto = detectReproto(candidates);

    const out = vscode.window.createOutputChannel("reproto extension");

    let type = config.get<string>("type");

    if (reproto) {
        console.log(`found reproto: ${reproto}`)

        const version = detectVersion(out, reproto);
        var actualType = type || defaultExtensionType(out, version, "simple");

        switch (actualType) {
            case "language-client":
                language_client.activate(context, config, reproto, out);
                break;
            case "simple":
                simple.activate(context, reproto, out);
                break;
            default:
                vscode.window.showErrorMessage(`unsupported extension kind: ${actualType}`);
                return;
        }

        vscode.window.showInformationMessage(`configured reproto: ${actualType}`);
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
