import type { Question, MediaReference } from '../types';
import { useTranslation } from 'react-i18next';
import type { ImageResources } from '../core/images';
import { plainText } from '../core/markup';
import { RichText } from './RichText';
import { LocalMedia } from './LocalMedia';
import { MediaVisibility } from './MediaVisibility';
import { Icon } from './Icon';
import { AnimatedDisclosure as Collapse } from './AnimatedDisclosure';
export function Reader({
  question: q,
  resources,
  active = true,
}: {
  question: Question;
  resources: ImageResources;
  active?: boolean;
}) {
  const { t } = useTranslation();
  // These two labels are authored by the parsers. Other labels belong to the source bank.
  const supplementLabel = (value: string) =>
    value === 'Context' ? t('reader.context') : value === 'Keywords' ? t('reader.keywords') : value;
  const rich = (value: string, dialogue = false) => (
    <RichText value={value} source={q.source} resources={resources} dialogue={dialogue} />
  );
  const imgs = (refs: string[]) =>
    refs.map((r, i) => (
      <LocalMedia
        key={i}
        reference={r}
        source={q.source}
        resources={resources}
        fallbackKind="image"
      />
    ));
  const media = (refs: MediaReference[] = []) =>
    refs.map((m, i) => (
      <LocalMedia
        key={m.field + '-' + i}
        reference={m.reference}
        source={q.source}
        resources={resources}
        fallbackKind={m.kind}
      />
    ));
  const label = (i: number) =>
    t('reader.partLabel', { number: q.parts[i].officialNumber || q.parts[i].number || i + 1 });
  return (
    <MediaVisibility active={active}>
      <article className="reader" aria-label={t('reader.region')}>
        {q.parts.length > 1 && (
          <nav className="part-nav" aria-label={t('reader.subquestions')}>
            <span>{t('reader.jumpTo')}</span>
            {q.parts.map((_, i) => (
              <button
                key={i}
                onClick={() =>
                  document.getElementById('part-' + i)?.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                    block: 'start',
                  })
                }
              >
                {label(i)}
              </button>
            ))}
          </nav>
        )}
        {q.topic && <div className="group-topic">{rich(q.topic)}</div>}
        {(q.context ||
          q.instructions ||
          q.images.length > 0 ||
          !!q.sharedMaterials?.length ||
          !!q.media?.length) && (
          <div className="shared-material">
            <Collapse
              label={t('reader.sharedMaterial')}
              preview={
                q.context
                  ? t('reader.passagePreview')
                  : q.images.length
                    ? t('reader.imagesPreview')
                    : t('reader.instructions')
              }
            >
              {q.instructions && (
                <section>
                  <h3>{t('reader.instructions')}</h3>
                  {rich(q.instructions)}
                </section>
              )}
              {q.context && rich(q.context, true)}
              {q.sharedMaterials?.map((material, i) => (
                <section key={i}>
                  <h3>{supplementLabel(material.label)}</h3>
                  {rich(material.text, true)}
                  {imgs(material.images || [])}
                  {media(material.media)}
                </section>
              ))}
              {imgs(q.images)}
              {media(q.media)}
            </Collapse>
          </div>
        )}
        {q.parts.map((p, i) => (
          <section
            className={
              'part-section' +
              (i === q.parts.length - 1 && (q.keyPoints || q.explanation)
                ? ' has-group-supplements'
                : '')
            }
            id={'part-' + i}
            key={i}
            aria-labelledby={'part-label-' + i}
          >
            <h2 id={'part-label-' + i}>
              {label(i)}
              <span> / {q.parts.length}</span>
            </h2>
            <Collapse
              label={t('reader.question')}
              preview={plainText(p.prompt || p.context).slice(0, 240) || t('reader.viewOriginal')}
            >
              {p.prompt && rich(p.prompt)}
              {p.context && (
                <section className="transcript">
                  <h3>{t('reader.transcript')}</h3>
                  {rich(p.context, true)}
                </section>
              )}
              {imgs(p.images)}
              {media(p.media)}
              {p.supplements?.map((supplement, j) => (
                <section key={j}>
                  <h3>{supplementLabel(supplement.label)}</h3>
                  {rich(supplement.text)}
                  {imgs(supplement.images || [])}
                  {media(supplement.media)}
                </section>
              ))}
              {p.options.length > 0 && (
                <section>
                  <h3>{t('reader.options')}</h3>
                  <div className="options">
                    {p.options.map((o, j) => (
                      <div className="option" key={j}>
                        <span className="option-label">{plainText(o.label)}.</span>
                        <div className="option-content">
                          {o.text && rich(o.text)}
                          {imgs(o.images || [])}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </Collapse>
            <div className={'answer-card ' + (!p.answers.length ? 'answer-missing' : '')}>
              <h3>
                {p.answers.length > 0 && <Icon name="check" size={16} />}
                {t('reader.referenceAnswer')}
              </h3>
              {p.answers.length ? rich(p.answers[0].text) : <p>{t('reader.answerMissing')}</p>}
              {p.answers.length > 0 && media(p.answers[0].media)}
            </div>
            {p.answers.length > 1 && (
              <Collapse
                label={t('reader.additionalAnswers')}
                count={t('reader.additionalCount', { count: p.answers.length - 1 })}
              >
                <div className="additional-answers">
                  {p.answers.slice(1).map((a, j) => (
                    <div key={j}>
                      {rich(a.text)}
                      {media(a.media)}
                    </div>
                  ))}
                </div>
              </Collapse>
            )}
            {p.translation && (
              <div className="supplement">
                <h3>{t('reader.translation')}</h3>
                {rich(p.translation)}
              </div>
            )}
            {p.explanation && (
              <Collapse label={t('reader.explanation')}>{rich(p.explanation)}</Collapse>
            )}
          </section>
        ))}
        {(q.keyPoints || q.explanation) && (
          <div className="group-supplements">
            {q.keyPoints && <Collapse label={t('reader.keyPoints')}>{rich(q.keyPoints)}</Collapse>}
            {q.explanation && (
              <Collapse label={t('reader.explanation')}>{rich(q.explanation)}</Collapse>
            )}
          </div>
        )}
        <p className="reader-footnote">{t('reader.sourceNote')}</p>
      </article>
    </MediaVisibility>
  );
}
