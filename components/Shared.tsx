
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
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}
export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'md', ...props }) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input',
    ghost: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent',
    danger: 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20',
    outline: 'bg-transparent border border-input hover:bg-accent text-foreground',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed',
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
    {label && <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">{label}</label>}
    <div className="relative group">
      {leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          {leftIcon}
        </div>
      )}
      <input
        className={cn(
          "w-full bg-card border border-input text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none placeholder:text-muted-foreground disabled:opacity-50 transition-all font-medium shadow-sm",
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
  const [localValue, setLocalValue] = React.useState<string | undefined>(value?.toString());

  React.useEffect(() => {
    const currentFloat = localValue ? parseFloat(localValue.replace(/\./g, '').replace(',', '.')) : undefined;
    if (value !== currentFloat) {
      setLocalValue(value ? value.toFixed(2).replace('.', ',') : '');
    }
  }, [value]);

  return (
    <div className="w-full">
      {label && <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">{label}</label>}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          <span className="text-sm font-semibold">R$</span>
        </div>
        <CurrencyInputField
          id={`currency-input-${label ? label.replace(/\s+/g, '-').toLowerCase() : Math.random().toString(36).substr(2, 9)}`}
          placeholder={placeholder || "0,00"}
          value={localValue}
          decimalsLimit={2}
          decimalSeparator=","
          groupSeparator="."
          onValueChange={(val, name, values) => {
            setLocalValue(val);
            onValueChange(values?.float ?? undefined);
          }}
          className={cn(
            "w-full bg-card border border-input text-foreground rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none placeholder:text-muted-foreground disabled:opacity-50 transition-all font-medium shadow-sm",
            className
          )}
          disabled={disabled}
          disableGroupSeparators={false}
          disableAbbreviations={true}
        />
      </div>
    </div>
  );
};


export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...props }) => (
  <div className="relative w-full">
    <select
      className={cn(
        "w-full appearance-none bg-card border border-input text-foreground rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-ring focus:border-primary outline-none disabled:opacity-50 transition-all cursor-pointer shadow-sm",
        className
      )}
      {...props}
    />
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
    </div>
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea
    className={cn(
      "w-full bg-card border border-input text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-ring focus:border-primary outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[100px] transition-all resize-none shadow-sm",
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
      <label className="text-xs text-muted-foreground block ml-1">Links & Recursos</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="url"
            placeholder="Adicionar URL (https://...)"
            className="w-full bg-input/50 md:bg-input/20 border border-input text-foreground text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:border-primary"
            value={tempLink}
            onChange={(e) => setTempLink(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!tempLink}
          className="bg-secondary text-secondary-foreground p-2 rounded-lg hover:bg-secondary/80 disabled:opacity-50 transition-colors border border-input"
        >
          <Plus size={18} />
        </button>
      </div>

      {links.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
          {links.map((link, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 bg-card px-3 py-2 rounded-md border border-border group">
              <a href={link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate flex-1 block">
                {link}
              </a>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors"
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
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' | 'neutral' | 'outline'; className?: string }> = ({ children, variant = 'default', className }) => {
  const styles = {
    default: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-primary/10 text-primary border-primary/20', // Emerald -> Primary
    warning: 'bg-secondary/10 text-secondary-foreground border-secondary/20', // Amber -> Secondary (Neutral/Dark)
    error: 'bg-destructive/10 text-destructive border-destructive/20',
    neutral: 'bg-muted text-muted-foreground border-border',
    outline: 'bg-transparent text-muted-foreground border-border',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', styles[variant], className)}>
      {children}
    </span>
  );
};
// --- Avatar ---
export const Avatar: React.FC<{ src?: string; name: string; size?: 'sm' | 'md' | 'lg' }> = ({ src, name, size = 'md' }) => {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const sizes = { sm: 'h-6 w-6 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };

  return (
    <div className={cn('relative inline-flex items-center justify-center rounded-full overflow-hidden bg-muted border border-border text-muted-foreground font-semibold', sizes[size])} title={name}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  );
};

// --- Loading Spinner ---
export const Loader: React.FC = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// --- ProgressBar ---
export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="w-full bg-secondary rounded-full h-2">
    <div
      className="bg-primary h-2 rounded-full transition-all duration-500"
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);
// --- Card ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'solid' | 'outline';
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, variant = 'solid', noPadding = false, onClick, ...props }) => {
  // EcoFlow Card Standard 2.2 - Unified Style
  // Dark: bg-slate-950 (via --card) + border-white/10
  // Light: bg-white (via --card) + border-slate-200
  // No distinct variants allowed anymore.

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl transition-all duration-200 bg-card border border-border shadow-premium", // White Card + Consistent Border + Premium Depth
        !noPadding && "p-5 md:p-6",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className={cn(
        "relative w-full bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200",
        className || "max-w-lg"
      )}>
        <div className="flex items-center justify-between p-5 border-b border-border/40 shrink-0 bg-muted/20 rounded-t-2xl">
          <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X size={18} />
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1 border border-border rounded-lg bg-secondary/30">
      {users.map(user => (
        <div
          key={user.id}
          onClick={() => toggleUser(user.id)}
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all",
            selectedIds.includes(user.id)
              ? "bg-primary/10 border-primary/30"
              : "bg-card border-border hover:bg-accent"
          )}
        >
          <div className={cn(
            "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
            selectedIds.includes(user.id) ? "bg-primary border-primary" : "border-muted-foreground"
          )}>
            {selectedIds.includes(user.id) && <div className="w-2 h-2 bg-primary-foreground rounded-full" />}
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar src={user.avatarUrl} name={user.name} size="sm" />
            <span className={cn("text-xs truncate", selectedIds.includes(user.id) ? "text-primary" : "text-card-foreground")}>{user.name}</span>
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
    if (task.status === 'done') return 'border-l-4 border-l-primary/30 opacity-60 bg-muted/10';
    const dueDate = parseISO(task.dueDate);
    const now = new Date();
    if (isPast(dueDate) && !isToday(dueDate)) {
      return 'border-l-4 border-l-destructive bg-card hover:bg-destructive/5';
    }
    const diff = differenceInDays(dueDate, now);
    if (diff <= 3 && diff >= 0) {
      return 'border-l-4 border-l-secondary bg-card hover:bg-secondary/5';
    }
    return 'border-l-4 border-l-primary bg-card hover:bg-primary/5';
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, taskId: string) => {
    if (onStatusChange) {
      onStatusChange(taskId, e.target.value as Status);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm text-muted-foreground">
        <thead className="bg-muted/50 text-foreground uppercase text-xs font-bold tracking-wider">
          <tr>
            <th className="px-6 py-4">Título</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Prioridade</th>
            <th className="px-6 py-4">Responsável</th>
            <th className="px-6 py-4">Prazo</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
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
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className={task.status === 'done' ? 'line-through opacity-60' : ''}>{task.title}</div>
                    {task.description && <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">{task.description}</div>}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative w-36">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(e, task.id)}
                        className={cn(
                          "appearance-none w-full text-xs font-semibold px-3 py-1.5 rounded-md border outline-none cursor-pointer pr-8 transition-colors shadow-sm",
                          task.status === 'done' ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' :
                            task.status === 'todo' ? 'bg-secondary text-secondary-foreground border-input hover:bg-secondary/80' :
                              'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'
                        )}
                      >
                        <option value="todo" className="bg-popover text-popover-foreground">A Fazer</option>
                        <option value="in_progress" className="bg-popover text-popover-foreground">Em Progresso</option>
                        <option value="review" className="bg-popover text-popover-foreground">Revisão</option>
                        <option value="done" className="bg-popover text-popover-foreground">Concluído</option>
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
                    ) : <span className="text-muted-foreground italic">--</span>}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-foreground">
                    {new Date(task.dueDate).toLocaleDateString('pt-BR')} <span className="text-muted-foreground ml-1">{new Date(task.dueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
