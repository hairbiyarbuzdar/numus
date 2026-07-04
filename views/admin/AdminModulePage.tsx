import React from "react";

interface AdminModulePageProps {
  title: string;
  subtitle: string;
  columns: string[];
  rows: string[][];
}

const AdminModulePage: React.FC<AdminModulePageProps> = ({ title, subtitle, columns, rows }) => {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-cyan-100">{subtitle}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 text-left font-semibold text-slate-700">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-t border-slate-100">
                  {row.map((value, valueIndex) => (
                    <td key={`${title}-${rowIndex}-${valueIndex}`} className="px-4 py-3 text-slate-600">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminModulePage;
