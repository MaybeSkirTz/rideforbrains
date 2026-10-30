import Scene from './Scene';
import { Link } from './ui';
import { useApp } from './context';
export function NeuralStory() {
  return (
    <section id="connexions" className="neural-explainer editorial-section">
      <p className="section-index">Du cerveau au mouvement</p>
      <div className="editorial-heading">
        <h2>
          Avant le premier pas,
          <br />
          <em>une connexion.</em>
        </h2>
        <p>
          Ces illustrations évoquent le signal et le mouvement. Elles racontent le lien entre notre
          cause et les trois activités de la journée.
        </p>
      </div>
      <div className="motion-triptych">
        {[
          {
            mode: 'synapse',
            number: '01',
            title: 'Les connexions.',
            text: 'Les neurones communiquent entre eux. Les points lumineux illustrent cet échange.',
          },
          {
            mode: 'signal',
            number: '02',
            title: 'Le signal.',
            text: 'Le signal circule. Les impulsions avancent le long des fibres.',
          },
          {
            mode: 'network',
            number: '03',
            title: 'Le mouvement.',
            text: 'Les connexions forment un réseau : l’image qui relie notre événement à la recherche sur le cerveau.',
          },
        ].map((s) => (
          <figure key={s.mode}>
            <Scene mode={s.mode as any} />
            <figcaption>
              <span>{s.number} /</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
export function GatheringStory() {
  const { data } = useApp();
  return (
    <section className="gathering-story editorial-section">
      <div className="editorial-heading">
        <div>
          <p className="section-index">Trois activités. Une même journée.</p>
          <h2>
            Des chemins différents.
            <br />
            <em>Un rendez-vous commun.</em>
          </h2>
        </div>
        <p>
          Bleu pour rouler. Vert pour courir. Lime pour marcher. Les trajectoires se rejoignent :
          chacun participe à sa façon.
        </p>
      </div>
      <Scene mode="convergence" />
      <p className="small">Illustration symbolique : les parcours officiels restent à confirmer.</p>
      <Link to="/inscription" className="button">
        Choisir mon activité —{' '}
        {new Date(data.settings.eventAt).toLocaleDateString('fr-CA', {
          day: 'numeric',
          month: 'long',
          timeZone: 'America/Toronto',
        })}
      </Link>
    </section>
  );
}
export function ArrivalStory() {
  const { data } = useApp();
  return (
    <section className="arrival-story">
      <div>
        <Scene mode="arrival" time={data.settings.reception} />
      </div>
      <div>
        <p className="section-index">Le premier repère</p>
        <h3>L’accueil à {data.settings.reception.replace(':', ' h ')}.</h3>
        <p>
          Les participants se retrouvent avant leur activité. L’horloge affiche l’heure d’ouverture
          de l’accueil; les heures de départ seront confirmées séparément.
        </p>
        <Link to="/infos" className="text-link">
          Préparer ma journée ↗
        </Link>
      </div>
    </section>
  );
}
export function SportMotionStory({ sport }: { sport: string }) {
  const s = (
    {
      velo: {
        mode: 'pedal',
        title: 'Le rythme vient du pédalier.',
        text: 'Le pédalier entraîne la roue. Cette animation accompagne les 100 kilomètres à vélo; elle ne représente pas le parcours officiel.',
      },
      course: {
        mode: 'stride',
        title: 'Une foulée après l’autre.',
        text: 'L’alternance des appuis donne le rythme. Choisissez 2, 5 ou 10 kilomètres selon l’activité qui vous ressemble.',
      },
      marche: {
        mode: 'steps',
        title: 'Trouver son pas.',
        text: 'Les pas alternent et le chemin se dessine. Cinq kilomètres pour participer à pied.',
      },
    } as any
  )[sport];
  if (!s) return null;
  return (
    <section className="sport-motion-story">
      <Scene mode={s.mode} />
      <div>
        <p className="section-index">Le mouvement en détail</p>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
      </div>
    </section>
  );
}
export function TeamMotion() {
  return (
    <div className="team-motion">
      <Scene mode="team" />
      <p>
        Thomas, François-Xavier et Sammy : trois personnes réunies pour organiser la même journée.
      </p>
    </div>
  );
}
export function PreparationMotion() {
  return (
    <section className="sport-motion-story">
      <Scene mode="preparation" />
      <div>
        <p className="section-index">Avant de partir</p>
        <h2>Préparer son équipement.</h2>
        <p>
          Un casque pour le vélo et de quoi s’hydrater : cette illustration rappelle de préparer son
          matériel. Les consignes complètes et les ravitaillements seront précisés par
          l’organisation.
        </p>
      </div>
    </section>
  );
}
