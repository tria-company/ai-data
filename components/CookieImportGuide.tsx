import { AlertCircle, FileJson, Info } from "lucide-react";

export default function CookieImportGuide() {
    return (
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Info size={16} className="text-blue-400" />
                Como obter cookies do Instagram:
            </h3>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-400 mb-4 ml-1">
                <li>Abra o <strong>Instagram.com</strong> no Chrome e faça login.</li>
                <li>Instale uma extensão de cookies (ex: Cookie-Editor ou EditThisCookie).</li>
                <li>Abra a extensão e clique em <strong>Exportar</strong> (formato JSON).</li>
                <li>Cole o conteúdo JSON no campo abaixo.</li>
            </ol>

            <div className="flex gap-2 text-[10px] text-slate-500 bg-slate-900/50 p-2 rounded border border-slate-800">
                <AlertCircle size={14} className="shrink-0 text-yellow-500/50" />
                <p>
                    <strong>Nota:</strong> Seus cookies são criptografados antes de serem salvos.
                    Eles expiram a cada ~90 dias. Se o scraping falhar, repita este processo.
                </p>
            </div>
        </div>
    );
}
