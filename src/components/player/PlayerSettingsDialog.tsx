import ReadingSettingsSections from '@/components/settings/ReadingSettingsSections';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import type { LeetoBook } from '@/types';

interface PlayerSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: LeetoBook;
  voices?: SpeechSynthesisVoice[];
}

/** Modal de ajustes del reproductor; las secciones son plegables y compartidas con Configuración. */
export default function PlayerSettingsDialog({
  open,
  onOpenChange,
  book,
  voices,
}: PlayerSettingsDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      height="content"
      title="Ajustes de lectura"
    >
      <div className="pb-8">
        <ReadingSettingsSections book={book} voices={voices} />
      </div>
    </ResponsiveDialog>
  );
}
