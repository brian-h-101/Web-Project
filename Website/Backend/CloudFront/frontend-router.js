function handler(event) {
    var request = event.request;

    // Rewrite requests that read pages.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return request;
    }

    // Remove trailing slashes when matching page routes.
    var path = request.uri.replace(/\/+$/, '') || '/';

    // Main portfolio pages use the portfolio entry document.
    var pageRoutes = [
        '/', '/about', '/engineering',
        '/resume', '/contact', '/projects'
    ];

    var isPage = pageRoutes.indexOf(path) !== -1;
    var isProjectPage = /^\/projects\/[^/]+$/.test(path);

    if (isPage || isProjectPage) {
        request.uri = '/index.html';
    }

    // FileSystem pages use their own React entry document.
    var fileSystemBase = '/demos/file-system-simulator';
    var fileSystemRoutes = [
        fileSystemBase,
        fileSystemBase + '/database',
        fileSystemBase + '/explorer',
        fileSystemBase + '/documents',
        fileSystemBase + '/catalog',
        fileSystemBase + '/auth/callback'
    ];

    var isFileSystemPage = fileSystemRoutes.indexOf(path) !== -1;
    var isDocumentPage =
        /^\/demos\/file-system-simulator\/documents\/[^/]+$/.test(path);

    if (isFileSystemPage || isDocumentPage) {
        request.uri = fileSystemBase + '/index.html';
    }

    return request;
}