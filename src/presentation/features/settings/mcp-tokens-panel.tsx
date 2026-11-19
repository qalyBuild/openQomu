import { useCallback, useEffect, useState } from 'react'
import {
  Bot,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { McpScope, McpToken } from '@/domain/entities/ai'
import { MCP_SCOPE_META, MCP_SCOPE_VALUES } from '@/domain/entities/ai'
import {
  generateMcpToken,
  normalizeScopes,
  validateTokenLabel,
} from '@/domain/services/mcp-token-service'
import { formatRelative } from '@/lib/date'
import { useContainer } from '@/app/auth-provider'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { InstallSkillBanner } from '@/presentation/features/settings/install-skill-banner'
import { cn } from '@/lib/utils'

const MCP_URL = ((import.meta.env.VITE_MCP_URL as string | undefined) ?? '').trim()
const TOKEN_ENV = 'OPENQOMU_MCP_TOKEN'

const MCP_TOOLS = [
  'list_workspaces',
  'get_workspace',
  'list_boards',
  'list_tasks',
  'get_task',
  'search_tasks',
  'list_members',
  'list_comments',
  'create_task',
  'update_task',
  'assign_reviewer',
  'move_task',
  'add_comment',
  'delete_task',
]

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
}

function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 shrink-0 gap-1.5 text-[0.68rem]"
      onClick={async () => {
        await copyText(value)
        setCopied(true)
        toast.success('Copiado al portapapeles.')
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Copiado' : label}
    </Button>
  )
}

function maskSecret(secret: string): string {
  if (secret.length <= 18) return '••••••••'
  return `${secret.slice(0, 12)}••••••••${secret.slice(-4)}`
}

function TokenSecret({
  token,
  revealed,
  onToggle,
}: {
  token: McpToken
  revealed: boolean
  onToggle: () => void
}) {
  if (!token.secret) {
    return (
      <p className="mt-1 text-[0.62rem] text-muted-foreground/80">
        Token creado antes de este cambio: no se puede mostrar. Crea uno nuevo si lo necesitas.
      </p>
    )
  }

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <code
        data-token-secret
        className="min-w-0 flex-1 break-all rounded-md border bg-background px-2 py-1 font-mono text-[0.62rem]"
      >
        {revealed ? token.secret : maskSecret(token.secret)}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground"
        onClick={onToggle}
        aria-label={revealed ? 'Ocultar token' : 'Mostrar token'}
        title={revealed ? 'Ocultar token' : 'Mostrar token'}
      >
        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground"
        onClick={() =>
          void copyText(token.secret as string).then(() => toast.success('Token copiado.'))
        }
        aria-label="Copiar token"
        title="Copiar token"
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  )
}

export function McpTokensPanel({ uid, workspaceId }: { uid: string; workspaceId: string }) {
  const container = useContainer()
  const [tokens, setTokens] = useState<McpToken[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('Mi agente')
  const [scopes, setScopes] = useState<McpScope[]>(['openqomu:read', 'openqomu:write'])
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<McpToken | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const isDemo = container.mode === 'demo'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await container.mcpTokens.list(uid)
      // Limpia tokens revocados de versiones anteriores: ya no deben existir.
      const legacyRevoked = list.filter((token) => token.revokedAt)
      if (legacyRevoked.length > 0) {
        await Promise.all(
          legacyRevoked.map((token) =>
            container.mcpTokens.remove(uid, token.id).catch(() => undefined),
          ),
        )
      }
      setTokens(list.filter((token) => !token.revokedAt))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los tokens.')
    } finally {
      setLoading(false)
    }
  }, [container, uid])

  useEffect(() => {
    void load()
  }, [load])

  const toggleScope = (scope: McpScope) => {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    )
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isDemo) return
    setCreating(true)
    try {
      const normalizedLabel = validateTokenLabel(label)
      const normalizedScopes = normalizeScopes(scopes)
      const generated = await generateMcpToken()
      await container.mcpTokens.create({
        uid,
        label: normalizedLabel,
        scopes: normalizedScopes,
        tokenHash: generated.hash,
        secret: generated.token,
      })
      setCreatedToken(generated.token)
      await load()
      toast.success('Token creado. Cópialo ahora: no se volverá a mostrar.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el token.')
    } finally {
      setCreating(false)
    }
  }

  const snippet = JSON.stringify(
    {
      mcpServers: {
        openqomu: {
          type: 'http',
          url: MCP_URL,
          headers: { Authorization: `Bearer \${${TOKEN_ENV}}` },
        },
      },
    },
    null,
    2,
  )

  const toggleReveal = (id: string) => {
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div data-glass-surface="panel" className="rounded-2xl border border-primary/20 bg-card/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Integración con IA (MCP)</h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Conecta Claude, Cursor, OpenCode, Codex u otro cliente MCP. Los tokens se guardan
                hasheados y puedes revocarlos cuando quieras.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
            <Sparkles className="size-3" /> MCP · tokens
          </Badge>
        </div>

        {isDemo && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            Estás en modo demo. Los tokens se guardan en memoria y no sirven para conectar el MCP
            real. Inicia sesión con Google para probar la integración.
          </div>
        )}

        <div className="mt-5">
          <InstallSkillBanner mcpUrl={MCP_URL} workspaceId={workspaceId} />
        </div>

        <div className="mt-4 grid gap-2 rounded-xl border border-border/70 bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Endpoint MCP</span>
            <CopyButton value={MCP_URL} />
          </div>
          <code className="break-all font-mono text-xs">{MCP_URL}</code>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="size-3.5" /> ¿Ya tienes un token?
          </p>
          <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
            Reutilízalo: no hace falta crear otro. Si lo perdiste, crea uno nuevo y revoca el
            anterior. La URL y el formato del token no cambian, así que las conexiones que ya
            funcionan siguen funcionando.
          </p>
        </div>

        <form
          onSubmit={create}
          className="mt-4 grid gap-3 rounded-xl border border-border/70 bg-background/60 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium">Crear token</p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                Se muestra una sola vez. Guárdalo como variable de entorno o archivo seguro.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 text-[0.68rem]"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn('size-3', loading && 'animate-spin')} /> Actualizar
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mcp-token-label" className="text-[0.7rem]">
              Nombre del token
            </Label>
            <Input
              id="mcp-token-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. OpenCode portátil"
              maxLength={60}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {MCP_SCOPE_VALUES.map((scope) => (
              <label
                key={scope}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-card/60 p-2.5 transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  checked={scopes.includes(scope)}
                  onCheckedChange={() => toggleScope(scope)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{MCP_SCOPE_META[scope].label}</span>
                  <span className="block text-[0.65rem] leading-relaxed text-muted-foreground">
                    {MCP_SCOPE_META[scope].description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <Button
            type="submit"
            size="sm"
            className="w-fit gap-1.5"
            disabled={creating || isDemo || scopes.length === 0}
            title={isDemo ? 'Disponible al iniciar sesión con Google' : undefined}
          >
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Crear token
          </Button>
        </form>

        {createdToken && (
          <div className="mt-4 grid gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Copia tu token ahora</p>
              <CopyButton value={createdToken} label="Copiar token" />
            </div>
            <code className="break-all rounded-lg bg-background/80 p-2 font-mono text-xs">
              {createdToken}
            </code>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Puedes volver a verlo en «Tus tokens» con el icono del ojo. Guárdalo en tu cliente
              como <code>{TOKEN_ENV}</code>.
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Tus tokens</p>
            <span className="text-[0.62rem] text-muted-foreground">
              {tokens.length} {tokens.length === 1 ? 'token' : 'tokens'}
            </span>
          </div>
          <p className="text-[0.62rem] leading-relaxed text-muted-foreground">
            Los tokens nuevos se guardan para poder mostrarlos después; solo tú puedes verlos. Los
            tokens creados antes de este cambio no se pueden recuperar. Al eliminar un token
            desaparece de la lista y deja de funcionar.
          </p>

          {loading ? (
            <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Cargando tokens…
            </p>
          ) : tokens.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
              Todavía no tienes tokens de IA. Crea uno para conectar tu agente.
            </p>
          ) : (
            <div className="grid gap-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/50 p-3"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <KeyRound className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                      {token.label}
                    </p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {token.scopes.map((scope) => MCP_SCOPE_META[scope].label).join(' · ')} ·
                      Creado {formatRelative(token.createdAt)}
                      {token.lastUsedAt
                        ? ` · Último uso ${formatRelative(token.lastUsedAt)}`
                        : ' · Sin usar todavía'}
                      <span className="ms-2 font-mono text-[0.6rem] opacity-60">
                        …{token.id.slice(-8)}
                      </span>
                    </p>
                    <TokenSecret
                      token={token}
                      revealed={revealed.has(token.id)}
                      onToggle={() => toggleReveal(token.id)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[0.68rem] text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(token)}
                  >
                    <Trash2 className="size-3" /> Eliminar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Configuración del cliente
            </span>
            <CopyButton value={snippet} label="Copiar JSON" />
          </div>
          <pre className="scrollbar-thin overflow-x-auto rounded-xl border border-border/70 bg-background/80 p-3 font-mono text-[0.68rem] leading-relaxed">
            {snippet}
          </pre>
          <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
            Añade la variable <code>{TOKEN_ENV}</code> con el token y reinicia el cliente. En
            OpenCode puedes usar <code>{'{file:~/.config/openqomu/token}'}</code> para leerlo de disco.
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Qué puede hacer</p>
          <div className="flex flex-wrap gap-1.5">
            {MCP_TOOLS.map((tool) => (
              <span
                key={tool}
                className="rounded-md bg-muted px-2 py-1 font-mono text-[0.62rem] text-muted-foreground"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar este token?"
        description={`“${deleteTarget?.label ?? ''}” dejará de funcionar inmediatamente y desaparecerá de la lista. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar token"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await container.mcpTokens.remove(uid, deleteTarget.id)
            if (deleteTarget.secret && deleteTarget.secret === createdToken) {
              setCreatedToken(null)
            }
            setRevealed((current) => {
              const next = new Set(current)
              next.delete(deleteTarget.id)
              return next
            })
            toast.success('Token eliminado.')
            setDeleteTarget(null)
            await load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el token.')
          }
        }}
      />
    </div>
  )
}
