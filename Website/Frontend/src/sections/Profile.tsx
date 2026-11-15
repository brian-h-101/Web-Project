import { Link } from 'react-router-dom';
import { skills } from '../data/projects';
export { Resume, resumeUrl } from './Resume';

export function About() {
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">PROFILE</span>
        <h1>About Brian Ho</h1>
        <p>
          I build personal software projects across web applications,
          cloud infrastructure, and reusable game systems.
        </p>
      </section>

      <section className="section split-section">
        <div>
          <span className="eyebrow">BACKGROUND</span>
          <h2>Education and project work</h2>
        </div>
        <div className="prose">
          <p>
            Bachelor of Arts in Computer Science,
            <br />
            Florida State University, December 2024.
          </p>
          <p>
            I designed and implemented the applications, framework tooling,
            tests, and portfolio integration shown here, using established
            libraries and cloud services.
          </p>
          <Link className="text-link" to="/resume">
            View résumé →
          </Link>
        </div>
      </section>

      <section className="section split-section">
        <div>
          <span className="eyebrow">APPROACH</span>
          <h2>Engineering Approach</h2>
        </div>
        <div className="prose">
          <p>
            I focus on explicit validation, predictable state changes,
            and useful failure feedback. The projects examine how retries,
            concurrent changes, and access permissions affect application behavior.
          </p>
          <p>
            Each case study connects design decisions to demonstrated behavior,
            tests, and known limits.
          </p>
          <Link className="text-link" to="/#projects">
            Explore the projects →
          </Link>
        </div>
      </section>

      <section className="section" aria-labelledby="skills-title">
        <h2 id="skills-title">Technical Skills</h2>
        <p className="section-intro">
          Technologies and practices demonstrated in the current projects.
        </p>
        <div className="skills-grid">
          {skills.map((skill) => (
            <section key={skill.title}>
              <h3>{skill.title}</h3>
              <p>{skill.detail}</p>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
export function Contact() {
  return <section className="page-heading"><span className="eyebrow">GET IN TOUCH</span><h1>Contact</h1><p>For software development opportunities or questions about these projects, reach me by email or visit my GitHub profile.</p><div className="actions"><a className="button" href="mailto:brianho101@gmail.com">brianho101@gmail.com</a><a className="button button-secondary" href="https://github.com/brian-h-101" target="_blank" rel="noopener noreferrer">GitHub profile<span className="sr-only"> (opens in a new tab)</span> ↗</a><Link className="text-link" to="/resume">View résumé →</Link></div></section>;
}
export function NotFound() {
  return <section className="page-heading not-found"><span className="eyebrow">404 / PAGE NOT FOUND</span><h1>That page could not be found</h1><p>Explore the project case studies or return to the homepage.</p><div className="actions"><Link className="button" to="/#projects">View projects →</Link><Link className="text-link" to="/">Return Home →</Link></div></section>;
}
