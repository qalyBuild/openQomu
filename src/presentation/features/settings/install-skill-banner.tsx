import { useMemo, useState } from 'react'
import { Check, ClipboardCopy, Sparkles, Terminal, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { buildInstallSkillPrompt } from '@/content/install-skill-prompt'

const HARNESSES = ['Claude Code', 'OpenCode', 'Cursor', 'Codex', 'Gemini CLI', 'Cline']

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

export function InstallSkillBanner({
  mcpUrl,
  workspaceId,
}: {
  mcpUrl: string
  workspaceId?: string
}) {
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(
    () => buildInstallSkillPrompt({ mcpUrl, workspaceId }),
    [mcpUrl, workspaceId],
  )

  async function copyPrompt() {
    try {
      await copyText(prompt)
      setCopied(true)
      toast.success('Prompt copiado. Pégalo en tu IA para instalar la skill y el MCP.')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      toast.error('No se pudo copiar el prompt. Revisa los permisos del portapapeles.')
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-sky-500/10 p-5 sm:p-6">
      <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-sky-500/15 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary"
          >
            <WandSparkles className="size-3" /> Instalación guiada
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Instalar Skill</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Copia un prompt y pégalo en tu IA. Detectará el harness que estés usando, instalará la
            skill de openQomu y dejará el MCP configurado y verificado. Si ya tenías openQomu conectado,
            reutiliza tu token y no cambies la URL.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              'Detecta tu harness',
              'Instala la skill',
              'Conecta el MCP',
              'Verifica con list_workspaces',
            ].map((step, index) => (
              <span
                key={step}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-muted-foreground"
              >
                <span className="grid size-4 place-items-center rounded-full bg-primary/15 text-[0.6rem] font-semibold text-primary">
                  {index + 1}
                </span>
                {step}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Terminal className="size-3.5" /> Compatible con:
            </span>
            {HARNESSES.map((harness) => (
              <span key={harness} className="font-medium text-foreground/80">
                {harness}
              </span>
            ))}
            <span>y más</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-64">
          <Button size="lg" className="h-11 w-full justify-center" onClick={() => void copyPrompt()}>
            {copied ? <Check /> : <ClipboardCopy />}
            {copied ? 'Prompt copiado' : 'Copiar prompt'}
          </Button>
          <p className="flex items-center justify-center gap-1 text-center text-[0.7rem] text-muted-foreground">
            <Sparkles className="size-3" /> No incluye tu token. Se pide aparte.
          </p>
        </div>
      </div>
    </section>
  )
}
