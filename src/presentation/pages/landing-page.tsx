import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  FolderOpen,
  Hash,
  KanbanSquare,
  Loader2,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth, useContainer } from '@/app/auth-provider'
import { QRCodeSVG } from 'qrcode.react'
import { Logo, BrandMark } from '@/presentation/components/brand/logo'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { publicApkUrl, publicAppOrigin } from '@/lib/app-url'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.29-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
      />
    </svg>
  )
}

const principles = [
  {
    title: 'Conversación',
    text: 'Canales, hilos y menciones. El contexto se queda donde nace, sin cadenas infinitas ni ruido.',
  },
  {
    title: 'Ejecución',
    text: 'Tableros, responsables y revisiones. Cada decisión se convierte en trabajo visible y en movimiento.',
  },
  {
    title: 'Memoria',
    text: 'Documentos y archivos junto a las conversaciones que los explican. El conocimiento no se pierde.',
  },
]

export function LandingPage() {
  const { status, pending, error, signInWithGoogle } = useAuth()
  const container = useContainer()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const isDemo = container.mode === 'demo'
  const apkUrl = publicApkUrl()

  useEffect(() => {
    if (status === 'authenticated') navigate(from ?? '/app', { replace: true })
  }, [from, navigate, status])

  // `?demo=1` abre la demo directamente: enlaces externos sin pasar por la landing.
  const autoDemoRequested = new URLSearchParams(location.search).get('demo') === '1'
  const demoStarted = useRef(false)
  useEffect(() => {
    if (!autoDemoRequested || !isDemo || status !== 'anonymous' || pending) return
    if (demoStarted.current) return
    demoStarted.current = true
    void signInWithGoogle()
  }, [autoDemoRequested, isDemo, pending, signInWithGoogle, status])

  return (
    <div className="safe-area-top relative min-h-svh overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[720px] bg-[radial-gradient(ellipse_55%_45%_at_50%_-12%,var(--surface-glow),transparent_72%)]" />

      <header className="relative z-20 mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 text-[0.8rem] text-muted-foreground md:flex">
          <a href="#producto" className="transition-colors hover:text-foreground">
            Producto
          </a>
          <a href="#flujo" className="transition-colors hover:text-foreground">
            Manifiesto
          </a>
          <a href="#seguridad" className="transition-colors hover:text-foreground">
            Seguridad
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signInWithGoogle()}
            disabled={pending}
            className="hidden rounded-full px-4 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Iniciar sesión
          </Button>
          <Button
            size="sm"
            onClick={() => void signInWithGoogle()}
            disabled={pending}
            className="h-9 gap-1.5 rounded-full px-4 text-xs"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {isDemo ? 'Probar demo' : 'Empezar'}
          </Button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-5xl px-5 pt-16 text-center sm:pt-24">
          <span className="mx-auto mb-7 block h-px w-10 bg-border" />
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.34em] text-muted-foreground">
            El espacio de tu equipo
          </p>
          <h1 className="mx-auto mt-7 text-balance text-[3rem] font-medium leading-[0.96] tracking-[-0.065em] sm:text-6xl md:text-7xl lg:text-[5.4rem]">
            Menos ruido.
            <br />
            <span className="text-muted-foreground/55">Más equipo.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-pretty text-[0.95rem] leading-relaxed text-muted-foreground sm:text-lg">
            Conversaciones, tareas y documentos en un solo lugar. Claro, rápido y en tiempo real,
            para que el equipo piense y avance en sintonía.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button
              size="lg"
              className="h-11 w-full gap-2 rounded-full px-6 text-sm sm:w-auto"
              onClick={() => void signInWithGoogle()}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isDemo ? (
                <Sparkles className="size-4" />
              ) : (
                <GoogleIcon className="size-4" />
              )}
              {isDemo ? 'Entrar a la demo' : 'Empezar con Google'}
              <ArrowRight className="size-3.5 opacity-60" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="h-11 w-full gap-1.5 rounded-full px-5 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground sm:w-auto"
            >
              <a href="#producto">
                Ver producto <ArrowRight className="size-3.5" />
              </a>
            </Button>
          </div>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[0.68rem] text-muted-foreground/80">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3 text-emerald-500/80" /> Sin tarjeta
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3 text-emerald-500/80" /> Google OAuth
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3 text-emerald-500/80" /> Listo en 30 segundos
            </span>
          </p>

          {error && (
            <p className="mx-auto mt-5 max-w-md rounded-full border border-destructive/25 bg-destructive/5 px-4 py-2 text-[0.7rem] text-destructive">
              {error}
            </p>
          )}
          {isDemo && (
            <p className="mx-auto mt-5 max-w-md text-[0.7rem] leading-relaxed text-amber-600/90 dark:text-amber-400/80">
              Estás viendo el modo demo. Explora un espacio real con datos locales; configura
              Firebase para colaborar en tiempo real.
            </p>
          )}
        </section>

        <ProductPreview />

        <section id="producto" className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.3em] text-primary/80">
                Producto
              </p>
              <h2 className="mt-5 text-balance text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-5xl">
                Un solo lugar.
                <br />
                <span className="text-muted-foreground/60">Sin fricción.</span>
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                openQomu no añade otra pestaña. Retira las que sobran y deja a la vista solo lo que
                ayuda a decidir, ejecutar y recordar.
              </p>
            </div>

            <div className="border-t border-border/70">
              {principles.map((principle, index) => (
                <div
                  key={principle.title}
                  className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-border/70 py-7 first:pt-7 sm:gap-6"
                >
                  <span className="pt-1 text-[0.62rem] tabular-nums tracking-[0.16em] text-muted-foreground/50">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-medium tracking-[-0.02em]">{principle.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                      {principle.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="flujo" className="mx-auto max-w-4xl px-5 py-20 text-center sm:py-28">
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.3em] text-primary/80">
            El principio
          </p>
          <blockquote className="mt-7 text-balance text-2xl font-medium leading-[1.25] tracking-[-0.035em] sm:text-3xl md:text-4xl">
            “La mejor herramienta no se nota. Ordena la conversación, aclara quién hace qué y
            guarda el contexto para que el equipo pueda pensar.”
          </blockquote>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-[0.6rem] uppercase tracking-[0.26em] text-muted-foreground/70">
            <span>Conversación</span>
            <span className="h-px w-6 bg-border" />
            <span>Decisión</span>
            <span className="h-px w-6 bg-border" />
            <span>Avance</span>
          </div>
        </section>

        <section id="seguridad" className="mx-auto max-w-6xl px-5 pb-24 sm:pb-28">
          <div className="grid divide-y border-y border-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              {
                icon: Lock,
                title: 'Google OAuth',
                text: 'Entra con tu cuenta. Sin contraseñas que recordar ni credenciales que compartir.',
              },
              {
                icon: Zap,
                title: 'Tiempo real',
                text: 'Mensajes, tareas y documentos se sincronizan al instante para todo el equipo.',
              },
              {
                icon: ShieldCheck,
                title: 'Roles claros',
                text: 'Acceso por espacio, invitaciones que caducan y permisos que respetan el trabajo.',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="px-1 py-8 sm:px-8">
                  <Icon className="size-4 text-muted-foreground/70" strokeWidth={1.7} />
                  <h3 className="mt-5 text-sm font-medium tracking-[-0.01em]">{item.title}</h3>
                  <p className="mt-2 max-w-xs text-[0.8rem] leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {apkUrl && (
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:pb-28">
          <div className="grid items-center gap-10 border-y border-border/70 py-12 sm:py-14 lg:grid-cols-[1fr_auto] lg:gap-16">
            <div className="max-w-lg">
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.3em] text-primary/80">
                Android
              </p>
              <h2 className="mt-4 text-balance text-3xl font-medium leading-[1.05] tracking-[-0.045em] sm:text-4xl">
                openQomu, también en tu bolsillo.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Escanea el código con la cámara de tu móvil o instala la APK directamente. Las
                siguientes actualizaciones se gestionan desde Ajustes → App.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" className="h-10 gap-2 rounded-full px-5 text-sm">
                  <a href={apkUrl} download="openqomu.apk">
                    <Download className="size-4" /> Instalar app
                  </a>
                </Button>
                <span className="text-[0.65rem] text-muted-foreground">
                  Android 7+ · Instalación interna
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-self-center lg:justify-self-end">
              <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
                <QRCodeSVG
                  value={apkUrl}
                  size={168}
                  level="Q"
                  bgColor="#ffffff"
                  fgColor="#0c0b12"
                  marginSize={1}
                  aria-label="Código QR para descargar openQomu en Android"
                />
              </div>
              <p className="mt-3 text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground/70">
                Escanea para instalar
              </p>
            </div>
          </div>
        </section>
        )}

        <section className="mx-auto max-w-6xl px-5 pb-24 sm:pb-32">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/35 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_50%_0%,var(--surface-glow),transparent_70%)]" />
            <div className="relative">
              <BrandMark className="mx-auto size-10 text-foreground/80" />
              <h2 className="mx-auto mt-7 max-w-md text-balance text-3xl font-medium leading-[1.05] tracking-[-0.045em] sm:text-4xl">
                Empieza en sintonía.
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Crea tu espacio, invita a tu equipo y deja que el trabajo encuentre su ritmo.
              </p>
              <Button
                size="lg"
                className="mt-8 h-11 gap-2 rounded-full px-6 text-sm"
                onClick={() => void signInWithGoogle()}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isDemo ? (
                  <Sparkles className="size-4" />
                ) : (
                  <GoogleIcon className="size-4" />
                )}
                {isDemo ? 'Entrar a la demo' : 'Crear mi espacio'}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 py-10 text-[0.68rem] text-muted-foreground sm:flex-row sm:px-8">
          <Logo />
          <p className="order-3 sm:order-2">© {new Date().getFullYear()} openQomu. Hecho para equipos que fluyen.</p>
          <div className="order-2 flex gap-5 sm:order-3">
            <span>Privacidad</span>
            <span>Términos</span>
            <span>Estado</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ProductPreview() {
  return (
    <section className="relative mx-auto mt-16 max-w-6xl px-4 sm:mt-24 sm:px-6">
      <div className="pointer-events-none absolute inset-x-16 top-10 -z-10 h-48 rounded-full bg-primary/10 blur-[100px]" />
      <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#0b0b10] shadow-[0_50px_140px_-60px_rgba(0,0,0,0.9)] ring-1 ring-white/5">
        <div className="flex h-10 items-center gap-2 border-b border-white/8 px-4">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/10" />
            <span className="size-2 rounded-full bg-white/10" />
          </div>
          <div className="mx-auto flex items-center gap-3 text-[0.58rem] text-white/35">
            <span>{new URL(publicAppOrigin()).host}</span>
          </div>
          <span className="flex items-center gap-1.5 text-[0.55rem] text-white/35">
            <span className="size-1.5 rounded-full bg-emerald-400/90" />
            En vivo
          </span>
        </div>

        <div className="grid min-h-[360px] grid-cols-[42px_1fr] sm:min-h-[460px] sm:grid-cols-[52px_188px_1fr]">
          <div className="flex flex-col items-center gap-3 border-e border-white/8 bg-white/[0.015] py-3">
            <BrandMark className="mb-1 size-6 text-white/80" />
            <span className="grid size-8 place-items-center rounded-lg bg-white/8 text-white">
              <MessageSquare className="size-3.5" />
            </span>
            {[KanbanSquare, FileText, FolderOpen].map((Icon, index) => (
              <span
                key={index}
                className="grid size-8 place-items-center rounded-lg text-white/30"
              >
                <Icon className="size-3.5" />
              </span>
            ))}
          </div>

          <div className="hidden border-e border-white/8 bg-white/[0.012] p-3 sm:block">
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5">
              <span className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[0.58rem]">
                🪐
              </span>
              <span className="text-[0.68rem] font-medium text-white/80">qalyBuild</span>
            </div>
            <div className="mt-4 space-y-0.5">
              {[
                ['Resumen', false],
                ['Chat', true],
                ['Tableros', false],
                ['Documentos', false],
                ['Archivos', false],
              ].map(([label, active]) => (
                <div
                  key={String(label)}
                  className={
                    active
                      ? 'rounded-md bg-white/8 px-2 py-1.5 text-[0.66rem] font-medium text-white/85'
                      : 'px-2 py-1.5 text-[0.66rem] text-white/35'
                  }
                >
                  {label}
                </div>
              ))}
            </div>
            <p className="mt-5 px-2 text-[0.52rem] font-medium uppercase tracking-[0.18em] text-white/25">
              Canales
            </p>
            {['general', 'producto', 'diseño'].map((channel) => (
              <div
                key={channel}
                className="flex items-center gap-1.5 px-2 py-1 text-[0.64rem] text-white/35"
              >
                <Hash className="size-2.5" /> {channel}
              </div>
            ))}
          </div>

          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[1fr_198px]">
            <div className="flex min-w-0 flex-col">
              <div className="flex h-11 items-center gap-2 border-b border-white/8 px-4">
                <Hash className="size-3.5 text-white/35" />
                <span className="text-[0.72rem] font-medium text-white/80">general</span>
                <span className="text-[0.58rem] text-white/25">· 3 miembros</span>
              </div>

              <div className="flex-1 space-y-4 px-4 py-5">
                {[
                  {
                    name: 'Ana Torres',
                    time: '10:24',
                    text: 'La beta sale el jueves. Dejo el checklist en Documentos.',
                  },
                  {
                    name: 'Bruno Vidal',
                    time: '10:26',
                    text: 'Kanban actualizado. Todo lo urgente está en revisión.',
                  },
                  {
                    name: 'Carla Méndez',
                    time: '10:31',
                    text: 'Los mockups finales ya están en Archivos ✨',
                  },
                ].map((message) => (
                  <div key={message.name} className="flex gap-2.5">
                    <UserAvatar name={message.name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[0.66rem] font-medium text-white/80">
                          {message.name}
                        </span>
                        <span className="text-[0.55rem] text-white/25">{message.time}</span>
                      </div>
                      <p className="mt-0.5 text-[0.7rem] leading-relaxed text-white/45">
                        {message.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="m-3 mt-0 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-[0.65rem] text-white/25">
                Escribe un mensaje…
                <span className="ms-auto flex size-6 items-center justify-center rounded-full bg-white/8 text-white/50">
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>

            <div className="hidden border-s border-white/8 p-4 lg:block">
              <div className="flex items-baseline justify-between">
                <p className="text-[0.66rem] font-medium text-white/70">Hoy</p>
                <span className="text-[0.52rem] text-white/25">14 nov</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  ['Cerrar la beta', 'Revisión', '#f59e0b'],
                  ['Revisar mockups', 'Diseño', '#8b5cf6'],
                  ['Publicar notas', 'Producto', '#10b981'],
                ].map(([title, label, color]) => (
                  <div key={title} className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full" style={{ background: color }} />
                      <span className="truncate text-[0.6rem] text-white/65">{title}</span>
                    </div>
                    <span className="mt-1 block text-[0.5rem] uppercase tracking-[0.14em] text-white/25">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-white/8 pt-3">
                <div className="flex items-center justify-between text-[0.52rem] text-white/30">
                  <span>Progreso</span>
                  <span>12 / 18</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full w-2/3 rounded-full bg-primary/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
