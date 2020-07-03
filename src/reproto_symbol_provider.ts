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
        _token: CancellationToken
    ): ProviderResult<SymbolInformation[]> {
        return this.byUri[document.uri.toString()] || [];
    }

    provideWorkspaceSymbols(
        query: string,
        _token: CancellationToken
    ): ProviderResult<SymbolInformation[]> {
        const out: SymbolInformation[] = [];

        const q = query.toLowerCase();

        for (const k in this.symbols) {
            for (const s of this.symbols[k]) {
                if (s.name.toLowerCase().indexOf(q) !== -1) {
                    out.push(s);
                    continue;
                }
            }
        }

        return out;
    }
}