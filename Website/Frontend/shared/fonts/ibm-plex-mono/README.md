# IBM Plex Mono browser assets

Unmodified static WOFF2 files from the official **@ibm/plex-mono 2.5.0** package. [provenance.json](provenance.json) records the pinned package archive, commit, integrity and individual file hashes. No package scripts or telemetry dependency are installed or executed.

The selected Latin1 and Pi subsets cover existing Latin text, accented labels, punctuation and technical symbols. The browser keeps a system monospace glyph fallback for characters outside these subsets. Regular, medium, semibold and bold have real normal and italic faces, including authored Markdown emphasis.

The shared browser theme owns the declarations and font variable; CSS-relative URLs let each Vite build emit its own assets at its existing base. Its license URL property deliberately retains the exact [copyright and complete OFL 1.1 license](LICENSE.txt) beside the emitted WOFF2 files in each independent application. It is not a runtime font loader.

These assets are browser-owned. Do not copy them into Shared/demo-theme.css, backend packages or the immutable game export. New public assets require separately reviewed release preparation; source handoff membership and local validation grant no publication authority.
