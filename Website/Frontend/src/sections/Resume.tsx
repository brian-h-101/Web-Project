import './Resume.css';

export const resumeUrl = '/resume/Brian-Ho-Resume.pdf';

export function Resume() {
  return (
    <div className="resume-view">
      <div className="resume-actions actions" aria-label="Original résumé document">
        <a className="button button-secondary" href={resumeUrl} download="Brian-Ho-Resume.pdf">Download PDF</a>
        <a className="text-link" href={resumeUrl} target="_blank" rel="noopener noreferrer">Open original PDF<span className="sr-only"> (opens in a new tab)</span> ↗</a>
      </div>
      <article className="resume-document" aria-label="Brian Ho résumé">
        <div className="resume-page" data-page="1">
          <header className="resume-header">
            <h1>Brian Ho</h1>
            <address>
              <a href="tel:8133007419">813-300-7419</a><span aria-hidden="true"> | </span>
              <a href="mailto:brianho101@gmail.com">brianho101@gmail.com</a><span aria-hidden="true"> | </span>
              <a href="https://github.com/brian-h-101">github.com/brian-h-101</a>
              <span aria-hidden="true"> | </span>
              <a href="https://brianho101-portfolio.com/">brianho101-portfolio.com</a>
            </address>
          </header>
          <section aria-labelledby="resume-profile">
            <h2 id="resume-profile">Professional Profile</h2>
            <p>Software engineer with a Computer Science background focused on designing and developing modular, extensible software systems. Experienced in system architecture, persistence, component integration, automated validation, regression testing, and developer tooling, with substantial hands-on experience building reusable software infrastructure for complex game development applications.</p>
          </section>
          <section aria-labelledby="resume-education">
            <h2 id="resume-education">Education</h2>
            <p><strong>Bachelor of Arts in Computer Science</strong> {' | '} Florida State University — Tallahassee, FL {' | '} December 2024</p>
          </section>
          <section aria-labelledby="resume-skills">
            <h2 id="resume-skills">Technical Skills</h2>
            <dl className="resume-skills">
              <dt>Languages:</dt><dd>Python, Java, C++, C, C#, GDScript, SQL</dd>
              <dt>Frameworks / Platforms:</dt><dd>React, Node.js, Flask, Godot 4</dd>
              <dt>Databases:</dt><dd>PostgreSQL, SQL Server, DynamoDB</dd>
              <dt>Cloud:</dt><dd>AWS — Lambda, SQS, SNS, API Gateway, EC2, S3, RDS, IAM</dd>
              <dt>Developer Tools:</dt><dd>Git, Docker, Visual Studio, VS Code, PyCharm, IntelliJ, Eclipse</dd>
              <dt>Libraries:</dt><dd>pandas, NumPy, Matplotlib</dd>
            </dl>
          </section>
          <section className="resume-development" aria-labelledby="resume-development">
            <h2 id="resume-development">Software Development Experience</h2>
            <div className="resume-entry-heading">
              <h3>Computer Role-Playing Game (CRPG) Framework</h3>{' '}
              <em>Godot 4 | GDScript | Git | Codex | Dec 2024 – Present</em>
            </div>
            <p>Making game development more efficient through reusable systems.</p>
            <ul>
              <li><strong>Design and develop the CRPG Framework,</strong> a reusable software foundation for 2D computer role-playing games whose non-visual runtime core exposes gameplay systems, application-state management, and framework services through modular programmatic APIs and configurable components.</li>
              <li><strong>Provide reusable RPG systems and extension patterns</strong> for characters, dialogue, quests, combat, inventory and equipment, locations, relationships, reputation, world state, and save/load functionality, allowing consuming projects to assemble, configure, and extend these capabilities rather than reimplementing them for each game.</li>
              <li><strong>Structure characters and world objects around composable capabilities,</strong> where typed data containers represent entity state, registered behaviors and framework services provide capabilities, and configuration defines game-specific data and behavior, enabling different roles and gameplay situations to share the same underlying framework logic.</li>
              <li><strong>Maintain a defined API boundary between framework infrastructure and game-specific implementation,</strong> allowing consuming applications to access framework functionality through public interfaces while retaining control of their content, presentation, interface configuration, and project-specific behavior.</li>
              <li><strong>Develop persistence, validation, regression-testing, and developer-tooling infrastructure</strong> to preserve durable game state, verify system contracts and integrations, detect regressions in existing functionality, and support continued framework development.</li>
              <li><strong>Validate framework reusability through independently authored game examples,</strong> where the shared framework is accessed through public APIs without modifying its core implementation, while each example defines its own content, extension modules, presentation, and interface configuration.</li>
            </ul>
          </section>
          <section aria-labelledby="resume-projects">
            <h2 id="resume-projects">Selected Technical Projects</h2>
            <div className="resume-entry">
              <div className="resume-entry-heading">
                <h3>File-System Simulator</h3>{' '}
                <em>React | Python | AWS Lambda | DynamoDB | S3 | Cognito | June 2023</em>
              </div>
              <ul>
                <li><strong>Developed a full-stack file-system and document library</strong> supporting hierarchical folders, document editing and viewing, tags, a shared product catalog, and read-only inspection of stored application records.</li>
                <li><strong>Implemented document metadata indexing and search</strong> to retrieve records through normalized keyword postings and ANY/ALL tag filters, with sorting and bounded pagination while keeping indexes synchronized with metadata and publication changes.</li>
                <li><strong>Preserved file-system consistency during edits</strong> through conditional DynamoDB writes and revision checks that maintain folder relationships, publication rules, and tag references while rejecting stale edits and invalid operations.</li>
                <li><strong>Separated interface, application, and storage responsibilities</strong> across React, Python APIs, DynamoDB metadata, and versioned document contents in private S3, with Cognito-protected administration and automated tests for search, persistence, permissions, and concurrent edits.</li>
              </ul>
            </div>
            <div className="resume-entry">
              <div className="resume-entry-heading">
                <h3>Product Ordering Platform</h3>{' '}
                <em>React | TypeScript | Python | AWS Lambda | DynamoDB | API Gateway | July 2024</em>
              </div>
              <ul>
                <li><strong>Designed and deployed a full-stack ordering application</strong> that receives and validates sample orders, records order details, and tracks status using a React/TypeScript interface, Python Lambda APIs, and DynamoDB persistence.
                  <ul>
                    <li><strong>Prevented duplicate orders and conflicting retries</strong> through idempotency keys, canonical request hashes, and atomic DynamoDB transactions that also reject conflicting catalog changes.</li>
                    <li><strong>Preserved accurate prices and historical order details</strong> using Python Decimal calculations and stored snapshots of product names, quantities, prices, and totals.</li>
                    <li><strong>Provided shared public order history</strong> so visitors can inspect sample orders and cancel eligible confirmed orders until midnight Eastern, with automated tests covering validation, pricing, retries, cancellation, expiry, and API failures.</li>
                  </ul>
                </li>
              </ul>
            </div>
          </section>
        </div>
        <div className="resume-page" data-page="2">
          <section className="resume-entry" aria-labelledby="resume-portfolio">
            <div className="resume-entry-heading">
              <h3 id="resume-portfolio">Portfolio Website &amp; Cloud Infrastructure</h3>{' '}
              <em>React | TypeScript | AWS CDK | Terraform | Cloudflare DNS | January 2025</em>
            </div>
            <ul>
              <li><strong>Built and published a software engineering portfolio</strong> presenting project case studies, embedding two AWS application demonstrations, and documenting a Godot framework in development.</li>
              <li><strong>Configured DNS, HTTPS delivery, and application routing</strong> using Terraform for Cloudflare DNS and ACM certificate validation, and AWS CDK for private S3 hosting, CloudFront delivery, HTTPS enforcement, and API routing.</li>
              <li><strong>Implemented deployment and delivery controls</strong> including security headers, cache policies, and verification scripts for website and application assets.</li>
            </ul>
          </section>
          <section aria-labelledby="resume-current">
            <h2 id="resume-current">Current Experience</h2>
            <div className="resume-entry-heading">
              <h3>Manager — Hot Tip Nails</h3>{' '}
              <em>December 2024 – Present</em>
            </div>
            <ul>
              <li><strong>Supervise daily customer flow and technician deployment,</strong> managing eight staff and adjusting real-time assignments to absorb peak-hour demand and prevent operational bottlenecks.</li>
              <li><strong>Act as the central escalation point for client intake,</strong> translating complex or ambiguous service requests into precise technical specifications to ensure first-time service accuracy.</li>
              <li><strong>Bridge cross-cultural and language barriers</strong> across a diverse team, establishing clear communication protocols to align technician availability, customer specifications, and shift priorities.</li>
              <li><strong>Spearhead real-time schedule adaptations</strong> in response to changing floor conditions, mitigating service bottlenecks and maintaining transparency across technical staff and clients.</li>
            </ul>
          </section>
          <section aria-labelledby="resume-coursework">
            <h2 id="resume-coursework">Relevant Coursework</h2>
            <div className="resume-coursework">
              <ul>
                <li>Software Engineering I &amp; II</li>
                <li>Software Engineering Capstone</li>
                <li>Operating Systems</li>
                <li>Data Structures I &amp; II</li>
                <li>Advanced Programming with Java</li>
              </ul>
              <ul>
                <li>Computer Organization</li>
                <li>Computer &amp; Network System Administration</li>
                <li>Unix Tools</li>
                <li>Programming Secure Parallel and Distributed Applications</li>
              </ul>
              <ul>
                <li>Offensive Computer Security</li>
                <li>Network Security</li>
                <li>Discrete Mathematics</li>
                <li>Introduction to Probability</li>
                <li>Applied Linear Algebra</li>
              </ul>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
