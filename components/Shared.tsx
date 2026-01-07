
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, Trash2, Link as LinkIcon, Plus } from 'lucide-react';
import { Task, User, Status, Priority } from '../types';
import { parseISO, isPast, isToday, differenceInDays } from 'date-fns';

// Utility for classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}
export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'md', ...props }) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-900/20',
    secondary: 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600',
    ghost: 'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
};

// --- Inputs ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
}
export const Input: React.FC<InputProps> = ({ className, label, leftIcon, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1 uppercase tracking-wider">{label}</label>}
    <div className="relative group">
      {leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-500 transition-colors">
          {leftIcon}
        </div>
      )}
      <input
        className={cn(
          "w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none placeholder:text-slate-600 disabled:opacity-50 transition-all font-medium",
          leftIcon && "pl-10",
          className
        )}
        {...props}
      />
    </div>
  </div>
);

// --- Currency Input ---
import CurrencyInputField from 'react-currency-input-field';

interface CurrencyInputProps {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onValueChange, label, placeholder, className, disabled }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1 uppercase tracking-wider">{label}</label>}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-500 transition-colors">
          <span className="text-sm font-semibold">R$</span>
        </div>
        <CurrencyInputField
          id="validation-custom-input"
          placeholder={placeholder || "0,00"}
          defaultValue={value}
          value={value}
          decimalsLimit={2}
          decimalSeparator=","
          groupSeparator="."
          onValueChange={(val) => {
            const num = val ? parseFloat(val.replace(',', '.')) : undefined;
            onValueChange(num);
          }}
          className={cn(
            "w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none placeholder:text-slate-600 disabled:opacity-50 transition-all font-medium",
            className
          )}
          disabled={disabled}
          intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
          disableGroupSeparators={false}
          disableAbbreviations={true}
          transformRawValue={(rawValue) => rawValue} // Can be used to validation
        />
      </div>
    </div>
  );
};


export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...props }) => (
  <div className="relative w-full">
    <select
      className={cn(
        "w-full appearance-none bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none disabled:opacity-50 transition-all cursor-pointer",
        className
      )}
      {...props}
    />
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
    </div>
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea
    className={cn(
      "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none placeholder:text-slate-500 disabled:opacity-50 min-h-[100px] transition-all resize-none",
      className
    )}
    {...props}
  />
);

export const LinkInput: React.FC<{ links: string[], onChange: (links: string[]) => void }> = ({ links, onChange }) => {
  const [tempLink, setTempLink] = React.useState('');

  const handleAdd = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (tempLink && !links.includes(tempLink)) {
      onChange([...links, tempLink]);
      setTempLink('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-400 block ml-1">Links & Recursos</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="url"
            placeholder="Adicionar URL (https://...)"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:border-emerald-500"
            value={tempLink}
            onChange={(e) => setTempLink(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!tempLink}
          className="bg-slate-700 text-white p-2 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>

      {links.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
          {links.map((link, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 bg-slate-800/50 px-3 py-2 rounded-md border border-slate-700/50 group">
              <a href={link} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline truncate flex-1 block">
                {link}
              </a>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-slate-500 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' | 'neutral'; className?: string }> = ({ children, variant = 'default', className }) => {
  const styles = {
    default: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', styles[variant], className)}>
      {children}
    </span>
  );
};

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void } & React.HTMLAttributes<HTMLDivElement>> = ({ children, className, onClick, ...props }) => (
  <div onClick={onClick} className={cn('bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-sm transition-all hover:border-slate-600', className)} {...props}>
    {children}
  </div>
);

// --- Avatar ---
export const Avatar: React.FC<{ src?: string; name: string; size?: 'sm' | 'md' | 'lg' }> = ({ src, name, size = 'md' }) => {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const sizes = { sm: 'h-6 w-6 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };

  return (
    <div className={cn('relative inline-flex items-center justify-center rounded-full overflow-hidden bg-slate-700 border border-slate-600 text-slate-300 font-semibold', sizes[size])} title={name}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  );
};

// --- Loading Spinner ---
export const Loader: React.FC = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
  </div>
);

// --- ProgressBar ---
export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="w-full bg-slate-700 rounded-full h-2">
    <div
      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className={cn(
        "relative w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-200",
        className || "max-w-lg"
      )}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- User Multi Select ---
export const UserMultiSelect: React.FC<{ users: User[], selectedIds: string[], onChange: (ids: string[]) => void }> = ({ users, selectedIds, onChange }) => {
  const toggleUser = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(uid => uid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1 border border-slate-700 rounded-lg bg-slate-900/50">
      {users.map(user => (
        <div
          key={user.id}
          onClick={() => toggleUser(user.id)}
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all",
            selectedIds.includes(user.id)
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-slate-800 border-slate-700/50 hover:bg-slate-700"
          )}
        >
          <div className={cn(
            "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
            selectedIds.includes(user.id) ? "bg-emerald-500 border-emerald-500" : "border-slate-500"
          )}>
            {selectedIds.includes(user.id) && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar src={user.avatarUrl} name={user.name} size="sm" />
            <span className={cn("text-xs truncate", selectedIds.includes(user.id) ? "text-emerald-300" : "text-slate-300")}>{user.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Task Table View ---
export const TaskTableView: React.FC<{
  tasks: Task[],
  users: User[],
  onDelete: (id: string) => void,
  onTaskClick?: (task: Task) => void,
  onStatusChange?: (taskId: string, status: Status) => void
}> = ({ tasks, users, onDelete, onTaskClick, onStatusChange }) => {
  const getUser = (id: string) => users.find(u => u.id === id);

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'neutral';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const translatePriority = (p: Priority) => {
    switch (p) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      case 'urgent': return 'Urgente';
      default: return p;
    }
  };

  const getRowClass = (task: Task) => {
    if (task.status === 'done') return 'border-l-4 border-l-emerald-500/30 opacity-60 bg-slate-800/50';
    const dueDate = parseISO(task.dueDate);
    const now = new Date();
    if (isPast(dueDate) && !isToday(dueDate)) {
      return 'border-l-4 border-l-rose-500 bg-rose-500/5 hover:bg-rose-500/10';
    }
    const diff = differenceInDays(dueDate, now);
    if (diff <= 3 && diff >= 0) {
      return 'border-l-4 border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10';
    }
    return 'border-l-4 border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10';
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, taskId: string) => {
    if (onStatusChange) {
      onStatusChange(taskId, e.target.value as Status);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm text-slate-400">
        <thead className="bg-slate-900/80 text-slate-200 uppercase text-xs font-bold tracking-wider">
          <tr>
            <th className="px-6 py-4">Título</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Prioridade</th>
            <th className="px-6 py-4">Responsável</th>
            <th className="px-6 py-4">Prazo</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                Nenhuma tarefa encontrada.
              </td>
            </tr>
          ) : (
            tasks.map(task => {
              const assignee = getUser(task.assigneeId);
              return (
                <tr
                  key={task.id}
                  className={cn(
                    "transition-colors cursor-pointer",
                    getRowClass(task)
                  )}
                  onClick={() => onTaskClick && onTaskClick(task)}
                >
                  <td className="px-6 py-4 font-medium text-slate-200">
                    <div className={task.status === 'done' ? 'line-through opacity-60' : ''}>{task.title}</div>
                    {task.description && <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">{task.description}</div>}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative w-36">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(e, task.id)}
                        className={cn(
                          "appearance-none w-full text-xs font-semibold px-3 py-1.5 rounded-md border outline-none cursor-pointer pr-8 transition-colors",
                          task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' :
                            task.status === 'todo' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20' :
                              'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
                        )}
                      >
                        <option value="todo" className="bg-slate-800 text-slate-300">A Fazer</option>
                        <option value="in_progress" className="bg-slate-800 text-slate-300">Em Progresso</option>
                        <option value="review" className="bg-slate-800 text-slate-300">Revisão</option>
                        <option value="done" className="bg-slate-800 text-slate-300">Concluído</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-current opacity-50">
                        <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={getPriorityColor(task.priority)}>{translatePriority(task.priority)}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    {assignee ? (
                      <div className="flex items-center gap-2" title={assignee.email}>
                        <Avatar size="sm" src={assignee.avatarUrl} name={assignee.name} />
                        <span className="truncate max-w-[120px]">{assignee.name}</span>
                      </div>
                    ) : <span className="text-slate-600 italic">--</span>}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-300">
                    {new Date(task.dueDate).toLocaleDateString('pt-BR')} <span className="text-slate-500 ml-1">{new Date(task.dueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                      className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Excluir Tarefa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
