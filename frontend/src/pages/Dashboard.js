import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText,
  Target,
  Timer,
  Upload,
  List,
  ArrowRight,
  Sparkles,
  BarChart3,
  Languages,
} from 'lucide-react';

/** Placeholder analytics until wired to live API */
const DUMMY_STATS = {
  totalInvoices: 128,
  averageAccuracy: 94.2,
  /** Average seconds to process one invoice */
  averageProcessingSeconds: 2.8,
};

const INVOICES_PER_MONTH = [
  { month: 'Jul', invoices: 12 },
  { month: 'Aug', invoices: 18 },
  { month: 'Sep', invoices: 15 },
  { month: 'Oct', invoices: 22 },
  { month: 'Nov', invoices: 28 },
  { month: 'Dec', invoices: 33 },
];

const LANGUAGE_DISTRIBUTION = [
  { name: 'English', value: 62, color: '#4f46e5' },
  { name: 'Hindi', value: 24, color: '#7c3aed' },
  { name: 'Spanish', value: 18, color: '#059669' },
  { name: 'French', value: 12, color: '#d97706' },
  { name: 'Other', value: 12, color: '#64748b' },
];

const chartTooltipStyle = {
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
};

const Dashboard = () => {
  usePageTitle('Dashboard');
  const stats = DUMMY_STATS;

  const statCards = [
    {
      label: 'Total invoices',
      value: stats.totalInvoices.toLocaleString(),
      sub: 'All-time processed',
      icon: FileText,
      accent: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Average accuracy',
      value: `${stats.averageAccuracy}%`,
      sub: 'Across extracted fields',
      icon: Target,
      accent: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Avg. processing time',
      value: `${stats.averageProcessingSeconds}s`,
      sub: 'Per invoice (OCR + model)',
      icon: Timer,
      accent: 'bg-amber-100 text-amber-600',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
          <Sparkles className="h-4 w-4" aria-hidden />
          Overview
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Analytics preview using sample data. Connect to your API when ready.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map(({ label, value, sub, icon: Icon, accent }) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
                  {value}
                </p>
                <p className="mt-1 text-xs text-gray-500">{sub}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${accent}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <BarChart3 className="h-5 w-5 text-indigo-600" aria-hidden />
                Invoices per month
              </h2>
              <p className="mt-1 text-sm text-gray-500">Volume trend (sample)</p>
            </div>
          </div>
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={INVOICES_PER_MONTH} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  width={36}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v) => [`${v} invoices`, 'Count']}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Bar
                  dataKey="invoices"
                  name="Invoices"
                  fill="#4f46e5"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Languages className="h-5 w-5 text-indigo-600" aria-hidden />
              Language mix
            </h2>
            <p className="mt-1 text-sm text-gray-500">Detected on upload (sample)</p>
          </div>
          <div className="mx-auto h-64 w-full max-w-[280px] sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={LANGUAGE_DISTRIBUTION}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {LANGUAGE_DISTRIBUTION.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v, name) => [`${v} invoices`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-600">
            {LANGUAGE_DISTRIBUTION.map((lang) => (
              <li key={lang.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lang.color }} />
                {lang.name}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>
          <p className="mt-1 text-sm text-gray-500">Jump to the tools you use most.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              to="/upload"
              className="flex items-center justify-between rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" aria-hidden />
                Upload invoice
              </span>
              <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
            </Link>
            <Link
              to="/invoices"
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              <span className="flex items-center gap-2">
                <List className="h-4 w-4 text-indigo-600" aria-hidden />
                View all invoices
              </span>
              <ArrowRight className="h-4 w-4 text-gray-400" aria-hidden />
            </Link>
          </div>
        </Card>

        <Card className="flex flex-col justify-center border-dashed bg-gray-50/50 p-6">
          <p className="text-sm font-medium text-gray-700">Demo analytics</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Figures and charts use illustrative data. Hook this page to your analytics API when you are ready to go live.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
