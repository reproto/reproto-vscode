import { workspace, ExtensionContext, OutputChannel, WorkspaceConfiguration, Uri, window } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { Reproto } from './reproto';

export function activate(
    cx: ExtensionContext,
    config: WorkspaceConfiguration,
    reproto: Reproto,
    out: OutputChannel
) {
    const args = ["language-server"];

    if (config.get<boolean>("debug")) {
        args.push("--debug");
        out.appendLine("reproto.debug: debug enabled");
    }

    var log = config.get<string>("log");

    if (log) {
        args.push("--log");
        args.push(log);
        out.appendLine(`reproto.log: logging to: ${log}`);
    }

    const serverOptions: ServerOptions = {
        command: reproto.path,
        args: args,
        options: {
            env: {
                "RUST_BACKTRACE": "1"
            }
        }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { language: 'toml', pattern: '**/reproto.toml' },
            { language: 'reproto' }
        ],
        synchronize: {
            configurationSection: 'reproto',
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    const client = new LanguageClient(
        'reproto',
        serverOptions,
        clientOptions
    );

    client.onReady().then(() => {
        // open a given test document.
        client.onNotification("$/openUrl", (u: any) => {
            const uri = Uri.parse(u);

            workspace.openTextDocument(uri).then(doc => {
                return window.showTextDocument(doc);
            });
        });
    });

    cx.subscriptions.push(client.start());
}