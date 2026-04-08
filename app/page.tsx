import Link from 'next/link';
import { Instagram, LayoutDashboard, LogIn, ListChecks, BarChart2, ScrollText } from 'lucide-react';

const links = [
  {
    href: '/admin/login-session',
    icon: LogIn,
    title: 'Login de Sessão',
    description: 'Faça login em uma conta do Instagram e capture os cookies de sessão para scraping.',
  },
  {
    href: '/old',
    icon: LayoutDashboard,
    title: 'Dashboard de Scraping',
    description: 'Selecione projeto, conta e alvos para disparar jobs de scraping manualmente.',
  },
  {
    href: '/admin/queues',
    icon: ListChecks,
    title: 'Filas (BullBoard)',
    description: 'Monitore jobs pendentes, em execução, falhos e concluídos nas filas de processamento.',
  },
  {
    href: 'http://aidata.devops-apogeu.uk:9999',
    icon: ScrollText,
    title: 'Logs (Dozzle)',
    description: 'Visualize logs em tempo real de todos os containers Docker do sistema.',
    external: true,
  },
  {
    href: 'http://aidata.devops-apogeu.uk:19999',
    icon: BarChart2,
    title: 'Métricas (Netdata)',
    description: 'Monitore CPU, memória, disco e rede do servidor em tempo real.',
    external: true,
  },
];

export default function HubPage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-8 font-sans">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-gray-800 pb-6 mb-10">
          <div className="bg-gradient-to-tr from-purple-600 to-pink-600 p-3 rounded-xl shadow-lg shadow-purple-900/20">
            <Instagram className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
              AI Data Platform
            </h1>
            <p className="text-gray-500 text-sm">Selecione uma funcionalidade para começar</p>
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map(({ href, icon: Icon, title, description, external }) => (
            <Link
              key={href}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="group bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-900 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="bg-gray-800 group-hover:bg-gray-700 p-2.5 rounded-lg transition-colors shrink-0">
                  <Icon className="h-5 w-5 text-gray-300" />
                </div>
                <div>
                  <p className="font-semibold text-gray-100 mb-1">{title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
