import { Link } from 'react-router-dom';
import { projects } from '../data/projects';
import { ProjectCard } from '../components/ProjectCard';

export function Home() {
  return <>
    <section className="hero" aria-labelledby="intro-title">
      <span className="eyebrow">BRIAN HO / SELECTED WORK</span>
      <h1 id="intro-title">Brian Ho — Software Developer</h1>
      <p>I build web applications and reusable game systems, with a focus on validation, reliable data updates, and clear user interactions.</p>
      <div className="actions"><Link className="button" to="/#projects">Explore projects <span aria-hidden="true">→</span></Link><Link className="button button-secondary" to="/resume">View résumé</Link><Link className="text-link" to="/contact">Contact</Link></div>
    </section>
    <section className="section featured" id="projects" tabIndex={-1} aria-labelledby="projects-title">
      <div className="section-heading"><div><span className="eyebrow">01 / PROJECTS</span><h2 id="projects-title">Selected Projects</h2></div></div>
      <div className="project-grid">{projects.map((project, index) => <ProjectCard project={project} index={index} key={project.slug} />)}</div>
    </section>
    <section className="section split-section" aria-labelledby="engineering-title">
      <div><span className="eyebrow">02 / ENGINEERING</span><h2 id="engineering-title">How This Portfolio Runs</h2></div>
      <div className="prose"><p>The portfolio brings together Cloudflare DNS, AWS hosting, two web applications, and a browser-based Godot game framework.</p><Link className="text-link" to="/engineering">Explore the hosting and deployment case study <span aria-hidden="true">→</span></Link></div>
    </section>
    <section className="section closing" aria-labelledby="next-title"><div><span className="eyebrow">03 / CONTACT</span><h2 id="next-title">Continue the Conversation</h2><p>For my background and project experience, view my résumé or get in touch.</p></div><div className="actions"><Link className="button button-secondary" to="/resume">View résumé</Link><Link className="text-link" to="/contact">Get in touch <span aria-hidden="true">→</span></Link></div></section>
  </>;
}
