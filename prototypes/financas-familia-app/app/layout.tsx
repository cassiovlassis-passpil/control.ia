import type { Metadata } from 'next';
import './styles.css';
import './overrides.css';
export const metadata: Metadata = { title: 'Finanças Família', description: 'Painel de orçamento familiar' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
