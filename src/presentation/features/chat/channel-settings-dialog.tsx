import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Hash, Loader2, Lock, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import type { Channel } from '@/domain/entities/chat'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { cn } from '@/lib/utils'

export function ChannelSettingsDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: Channel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const container = useContainer()
  const { workspace, members } = useWorkspaceData()
  const navigate = useNavigate()
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description)
  const [memberIds, setMemberIds] = useState<string[]>(channel.memberIds)
  const [saving, setSaving] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(channel.name)
    setDescription(channel.description)
    setMemberIds(
      channel.type === 'private'
        ? [...new Set([channel.createdBy, ...channel.memberIds])]
        : [],
    )
  }, [channel, open])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await container.channels.update(workspace.id, channel.id, {
        name,
        description,
        ...(channel.type === 'private'
          ? { memberIds: [...new Set([channel.createdBy, ...memberIds])] }
          : {}),
      })
      toast.success('Canal actualizado.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el canal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {channel.type === 'private' ? (
                <Lock className="size-4 text-primary" />
              ) : (
                <Hash className="size-4 text-primary" />
              )}
              Ajustes de #{channel.name}
            </DialogTitle>
            <DialogDescription>
              Cambia el nombre, la descripción o quién puede acceder.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-channel-name">Nombre</Label>
              <Input
                id="edit-channel-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-channel-description">Descripción</Label>
              <Textarea
                id="edit-channel-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                maxLength={300}
              />
            </div>

            {channel.type === 'private' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> Personas con acceso
                </Label>
                <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-1">
                  {members.map((member) => {
                    const isCreator = member.uid === channel.createdBy
                    const selected = memberIds.includes(member.uid)
                    return (
                      <button
                        key={member.id}
                        type="button"
                        disabled={isCreator}
                        onClick={() =>
                          setMemberIds((current) =>
                            current.includes(member.uid)
                              ? current.filter((id) => id !== member.uid)
                              : [...current, member.uid],
                          )
                        }
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs transition-colors',
                          selected ? 'bg-primary/5' : 'hover:bg-muted',
                          isCreator && 'opacity-70',
                        )}
                      >
                        <UserAvatar
                          name={member.displayName}
                          photoURL={member.photoURL}
                          size="xs"
                        />
                        <span className="min-w-0 flex-1 truncate">{member.displayName}</span>
                        {isCreator ? (
                          <span className="text-[0.6rem] text-muted-foreground">creador</span>
                        ) : (
                          <span
                            className={cn(
                              'grid size-4 place-items-center rounded-full border text-[0.55rem]',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border',
                            )}
                          >
                            {selected ? '✓' : ''}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[0.65rem] text-muted-foreground">
                  Solo estas personas verán el canal y sus mensajes.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="size-4" /> Archivar
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`¿Archivar #${channel.name}?`}
        description="El canal dejará de aparecer en la barra lateral. Los mensajes se conservan."
        confirmLabel="Archivar canal"
        onConfirm={async () => {
          try {
            await container.channels.update(workspace.id, channel.id, { archived: true })
            toast.success('Canal archivado.')
            onOpenChange(false)
            navigate(`/w/${workspace.id}/dashboard`)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo archivar el canal.')
          }
        }}
      />
    </>
  )
}
