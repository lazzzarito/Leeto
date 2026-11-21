import { memo, type RefObject } from 'react';
import type { LeetoBlock } from '@/types';
import ImageBlock from './ImageBlock';
import KineticText, { type KineticTextHandle } from './KineticText';

interface BlockViewProps {
  block: LeetoBlock;
  text: string;
  kineticRef: RefObject<KineticTextHandle>;
  fontSize: number;
  lineHeight: number;
  dimIntensity: number;
  kenBurns: boolean;
  variant?: 'body' | 'subtitle';
  fill?: boolean;
}

/** Envoltorio estable: los cambios del playhead no pasan por React. */
const BlockView = memo(function BlockView({
  block,
  text,
  kineticRef,
  fontSize,
  lineHeight,
  dimIntensity,
  kenBurns,
  variant = 'body',
  fill = false,
}: BlockViewProps) {
  if (block.type === 'image') {
    return (
      <ImageBlock
        assetId={block.assetId}
        alt={block.alt}
        caption={block.caption}
        kenBurns={kenBurns}
        fill={fill}
      />
    );
  }

  return (
    <KineticText
      ref={kineticRef}
      content={text}
      variant={variant}
      fontSize={fontSize}
      lineHeight={lineHeight}
      dimIntensity={dimIntensity}
    />
  );
});

export default BlockView;
