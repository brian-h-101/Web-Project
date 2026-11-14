import { Link } from 'react-router-dom';
import { Architecture } from '../components/Architecture';
import { projects } from '../data/projects';

const services = [
  ['CloudFront', 'HTTPS delivery, cached static assets, and ordered, uncached application API behaviors.'],
  ['S3', 'Private website assets through CloudFront origin access control; a separate private, versioned bucket holds document content.'],
  ['API Gateway', 'HTTP routes connect each application to Lambda. Administrator routes use a JWT authorizer and a required write scope.'],
  ['Lambda', 'Python application logic. File-System published reads, shared content and administrator operations have separate functions and execution roles.'],
  ['DynamoDB', 'Commerce orders and temporary history; persistent filesystem metadata and a product/tag catalog shared by both applications.'],
  ['Cognito', 'Administrator managed login, authorization code with PKCE, mandatory TOTP, and scoped access tokens.'],
  ['IAM', 'Service-specific execution roles and scoped data access. The browser never receives AWS credentials.'],
  ['ACM', 'The existing us-east-1 certificate supports CloudFront HTTPS. Application resources are hosted in us-east-2.'],
  ['CDK / CloudFormation', 'TypeScript infrastructure definitions, reviewed synthesized templates, and separate hosting, Commerce, File-System/catalog, and budget stacks.'],
  ['CloudWatch / Budgets', 'Application logs with configured retention, plus account budget notifications. These support operations; alerts do not impose an absolute spending cap.'],
];
export function Engineering() {
  return <>
    <section className="page-heading"><h1>How This Portfolio Runs on AWS</h1><p>I built the portfolio interface, integrated two live web demonstrations, and documented a reusable Godot framework. The site uses Amazon Route 53 for DNS and AWS services for hosting, application APIs, and data storage.</p></section>
    <nav className="section-nav" aria-label="Engineering sections">{[['Architecture','architecture'],['AWS service reference','services'],['Routing and access','http'],['Deployment','deployment']].map(([label,target])=><Link to={'#'+target} key={target}>{label}</Link>)}</nav>
    <section className="section" id="architecture" tabIndex={-1} aria-labelledby="portfolio-architecture-title">
      <span className="eyebrow">01 / ARCHITECTURE</span><h2 id="portfolio-architecture-title">System Architecture</h2>
      <p className="section-intro">Amazon Route 53 is the authoritative DNS provider. After DNS resolution, the browser connects to CloudFront over HTTPS. AWS hosts the static assets, application APIs, and data.</p>
      <Architecture label="Website delivery" caption="DNS resolution followed by HTTPS asset delivery" steps={[
        {name:'Public browser',description:'Resolve the portfolio hostname'},
        {name:'Amazon Route 53',description:'Alias records resolve the portfolio hostnames to CloudFront.'},
        {name:'CloudFront',description:'HTTPS, static caching and API routing'},
        {name:'Private website S3',description:'Portfolio and demo assets through origin access control'},
      ]}/>
      <p className="diagram-note">Route 53 handles DNS resolution; CloudFront delivers website assets over HTTPS. Godot gameplay runs locally in the browser.</p>
      <div className="testing-grid">{projects.map(project=><section key={project.slug}><h3>{project.name}</h3><p>{project.demoKind==='commerce'?'Python services validate prices and commit orders/retry markers in DynamoDB against the shared catalog.':project.demoKind==='filesystem'?'Metadata and indexes live in DynamoDB; immutable document bodies use a private versioned S3 bucket.':'A versioned Godot Web export provides five examples with browser-local saves and no gameplay backend.'}</p><Link className="text-link" to={'/projects/'+project.slug+'#architecture'}>Explore this architecture →<span className="sr-only"> — {project.name}</span></Link></section>)}</div>
    </section>
    <section className="section" aria-labelledby="services-title"><span className="eyebrow">02 / SERVICES</span><details className="historical-records"><summary id="services"><h2 id="services-title">AWS service reference</h2></summary><p className="section-intro">Terraform retains DNS/certificate ownership; CDK/CloudFormation manages the website, two application backends and budget as separate stacks.</p><dl className="service-list">{services.map(([name,detail])=><div key={name}><dt>{name}</dt><dd>{detail}</dd></div>)}</dl></details></section>
    <section className="section" id="http" tabIndex={-1} aria-labelledby="http-title">
      <span className="eyebrow">03 / ROUTING</span><h2 id="http-title">Routing and access</h2>
      <p className="section-intro">Portfolio pages and demonstrations share one HTTPS address. Application requests are routed to their services, where the server checks access and validates each operation.</p>

      <div id="apis" tabIndex={-1} aria-label="API routing and access">
      <div className="route-table"><table><caption>CloudFront API routing precedence</caption><thead><tr><th scope="col">Path</th><th scope="col">Application boundary</th></tr></thead><tbody><tr><th scope="row"><code>/api/filesystem/*</code></th><td>File-System HTTP API → hierarchy and document services</td></tr><tr><th scope="row"><code>/api/catalog/*</code></th><td>File-System / Catalog HTTP API → products and tags</td></tr><tr><th scope="row"><code>/api/*</code></th><td>Commerce HTTP API → order services</td></tr></tbody></table></div>
      <div className="testing-grid"><section><h3>Published and shared content</h3><p>Published File-System browsing keeps visibility checks. Separately enabled anonymous shared-content routes allow ordinary edits, including drafts, through verified capabilities and scoped roles.</p></section><section><h3>Protected administration</h3><p>Cognito signs administrators in with PKCE and TOTP. JWT/catalog-write checks at API Gateway and independent Lambda claim/group checks protect administrator operations. Shared content access grants no AWS, user, reset or recovery authority.</p></section><section><h3>Public orders</h3><p>New public-orders-v1 records and sample email labels are shared. Any visitor can cancel an eligible confirmed order until next midnight America/New_York. Legacy private orders stay isolated; original request keys remain bound to their public day.</p></section></div>
      <p className="diagram-note">API caching is disabled. Browser credentials and cache settings are not authorization; the server enforces each route’s contract. A connection or health check establishes neither successful mutations nor complete workflow acceptance.</p>
      </div>
      <details className="historical-records"><summary>HTTP routing and response details</summary><p>CloudFront selects an origin by path; API Gateway selects a method and route, then invokes the Python Lambda handler. Successful reads use 200, created resources 201, invalid input 400, access failures 401/403, hidden or missing resources 404, and revision/retry conflicts 409.</p><p>Extensionless portfolio pages resolve to the portfolio shell. File-System paths use their own shell, including the Cognito callback. Missing assets and API failures retain their real error responses. The résumé PDF is a static file, not an HTML fallback.</p></details>
    </section>
    <section className="section" id="deployment" tabIndex={-1} aria-labelledby="deployment-title">
      <span className="eyebrow">04 / DEPLOYMENT</span><h2 id="deployment-title">Build → Review → Publish → Verify</h2>
      <ol className="deployment-steps"><li><strong>Build</strong><p>Produce separate portfolio, Commerce and File-System browser bundles, then validate and stage the frozen Godot export and static documents.</p></li><li><strong>Review</strong><p>Compare all stack templates, source hashes and complete asset payloads. Offline synthesis and real-context live comparison are distinct checks.</p></li><li><strong>Publish</strong><p>Website releases exclusively target the existing website stack. Backend releases are separate operations; presentation changes preserve backend code, permissions, data and capacity.</p></li><li><strong>Verify</strong><p>Check actual deployed state and served bytes on both domains, then exercise the relevant browser behavior within its stated scope.</p></li></ol>
    </section>
    <nav className="end-navigation" aria-label="Continue exploring"><Link className="text-link" to="/#projects">Explore the projects →</Link><Link className="text-link" to="/about">About Brian →</Link></nav>
  </>;
}
