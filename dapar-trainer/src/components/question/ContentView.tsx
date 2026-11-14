import type { Content } from '../../questions/types';
import { FigureView } from '../figures/MatrixFigure';

/** מציג קטע תוכן של שאלה. ביטויים מתמטיים מוצגים LTR בתוך הדף ה-RTL */
export function ContentView({ content, className = '' }: { content: Content; className?: string }) {
  if (content.kind === 'figure') return <FigureView figure={content.figure} alt={content.alt} />;
  if (content.ltr) {
    return (
      <bdi dir="ltr" className={`math ${className}`}>
        {content.text}
      </bdi>
    );
  }
  return <span className={className}>{content.text}</span>;
}

export function contentLabel(c: Content): string {
  return c.kind === 'text' ? c.text : c.alt;
}
