import { DocumentSymbolProvider, WorkspaceSymbolProvider, SymbolInformation, CancellationToken, TextDocument, ProviderResult } from 'vscode';

export class ReprotoSymbolProvider implements DocumentSymbolProvider, WorkspaceSymbolProvider {
    symbols: { [key: string]: SymbolInformation[] };
    byUri: { [key: string]: SymbolInformation[] };

    constructor() {
        this.symbols = {};
        this.byUri = {};
    }

    provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken
    ): ProviderResult<SymbolInformation[]> {
        return this.byUri[document.uri.toString()] || [];
    }

    provideWorkspaceSymbols(
        query: string,
        token: CancellationToken
    ): ProviderResult<SymbolInformation[]> {
        let out: SymbolInformation[] = [];

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