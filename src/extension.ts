'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as simple from './reproto_simple';
import * as languageClient from './reproto_language_client';
import * as install from './install';
import { Reproto } from './reproto';

function detectCandidates(config: vscode.WorkspaceConfiguration): [string[], string[]] {
    const displays: string[] = [];
    const candidates: string[] = [];

    const platform = install.getPlatform();
    const exe = install.getExe(platform);

    const executable = config.get<string>("executable");

    if (executable) {
        displays.push("reproto.executable (user configuration)");
        candidates.push(executable);
    } else {
        displays.push("reproto.executable (user configuration) is not defined");
    }

    if (process.env.REPROTO_HOME) {
        displays.push("$REPROTO_HOME/reproto");
        candidates.push(path.join(process.env.REPROTO_HOME), exe);
    } else {
        displays.push("$REPROTO_HOME is not defined");
    }

    if (process.env.HOME) {
        displays.push("$HOME/.local/bin/reproto");
        candidates.push(path.join(process.env.HOME, ".local", "bin", exe));
    } else {
        displays.push("$HOME is not defined");
    }

    if (process.env.USERPROFILE) {
        displays.push("$USERPROFILE/.local/bin/reproto");
        candidates.push(path.join(process.env.USERPROFILE, ".local", "bin", exe));
    } else {
        displays.push("$USERPROFILE is not defined");
    }

    if (process.env.PATH) {
        displays.push("$PATH");

        process.env.PATH.split(path.delimiter).forEach((p: string) => {
            candidates.push(path.join(p, exe));
        });
    } else {
        displays.push("$PATH is not defined");
    }

    return [displays, candidates];
}

function detectReproto(candidates: string[]): Reproto | undefined {
    for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];

        if (c && fs.existsSync(c)) {
            return new Reproto(c, vscode.workspace.rootPath);
        }
    }

    return undefined;
}

/**
 * Try to determine the version of reproto.
 */
async function detectVersion(
    out: vscode.OutputChannel,
    reproto: Reproto
): Promise<[number, number, number] | null> {
    try {
        var output = await reproto.version();

        const p = output.split(/[ \t]+/);

        if (p.length >= 2 && p[0] == "reproto") {
            const c = p[1].split(/[\.-]/);

            if (c.length >= 3) {
                const major = parseInt(c[0]);
                const minor = parseInt(c[1]);
                const patch = parseInt(c[2]);

                out.appendLine(`detected \`${reproto}\` version: ${major}.${minor}.${patch}`);
                return [major, minor, patch];
            }
        }
    } catch (e) {
        out.appendLine(`failed to detect version: ${reproto}:`)
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

async function internalActivate(
    context: vscode.ExtensionContext,
    out: vscode.OutputChannel
): Promise<void> {
    const config = vscode.workspace.getConfiguration("reproto");

    const [displays, candidates] = detectCandidates(config);
    const reproto = detectReproto(candidates);

    if (reproto) {
        const version = await detectVersion(out, reproto);

        if (version) {
            let type = config.get<string>("type");
            let [major, minor, patch] = version;

            out.appendLine(`using reproto from \`${reproto}\``)
            var actualType = type || defaultExtensionType(out, version, "simple");

            let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            item.text = `reproto ${major}.${minor}.${patch} (${actualType})`;
            item.show();

            context.subscriptions.push(item);

            switch (actualType) {
                case "language-client":
                    languageClient.activate(context, config, reproto, out);
                    break;
                case "simple":
                    simple.activate(context, reproto, out);
                    break;
                default:
                    vscode.window.showErrorMessage(`unsupported extension kind: ${actualType}`);
                    break;
            }

            context.subscriptions.push(vscode.commands.registerCommand("reproto.init", () => {
                out.appendLine("Command: Initializing new project");

                return reproto.init(out).then(() => {
                    vscode.window.showInformationMessage("Project Initialized");
                }).catch(e => {
                    vscode.window.showErrorMessage(`Failed to initialize project: ${e}`);
                });
            }));

            return;
        }
    }

    out.appendLine("usable `reproto` command could not be found!")
    out.appendLine("looked in the following places:");

    displays.forEach((d, i) => {
        out.appendLine(`#${i}: ${d}`);
    });

    out.show(true);

    // attempt to install
    let action = await vscode.window.showErrorMessage(
        "Usable `reproto` command could not be found!",
        "Do nothing",
        "Install reproto"
    );

    if (action != "Install reproto") {
        return;
    }

    install.install(out).then(() => {
        out.appendLine("reactivating extension");
        internalActivate(context, out);
    }).catch(e => {
        vscode.window.showErrorMessage(e.toString());
    });
}

export function activate(context: vscode.ExtensionContext) {
    const out = vscode.window.createOutputChannel("reproto extension");
    context.subscriptions.push(out);
    internalActivate(context, out);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
