Components used build the front end of the Curator Tool web project.

# CuratorToolFrontend

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.2.4.

## Development server

Run npm install to install angular, and ngrx

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

Back end project is at: https://github.com/reactome/curator-tool-ws.git

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

**Note**: For the time being, this app is deployed at curator.reactome.org: html/curatortool. Try to add the following argument after build: `ng build --base-href=/curatortool/` (check this is in the head: <base href="/curatortool/">). Make sure the spelling is correct! After building, tar and scp to that folder.

**Note**: The backend springboot app for the time being is deployed as a standalone, runnable java by running mvn clean package directly. The generated jar file should be copied. Before build, make sure configuration in applications.properties is correct for curator.reactome.org, mainly the password for neo4j and the local file names. 

**Note**: To make the server works with the above deployment, the following changes may have to make in file common-sites-conf/001-reactome.conf. After change, restart apache2 if need `sudo service apache2 restart`:

```
43,46d42
<   <Directory "/usr/local/gkb/website/html/curatortool">
<       AllowOverride All
<   </Directory>
< 
63d58
<   ProxyPass       /api/ http://localhost:9090/api/
<   ProxyPass       /llm/ http://127.0.0.1:5000/
```

Also add a .htaccess into the newly created curatortool folder with the following content:

```
#Note: may need to refactor the following configure to avoid unsafe-inline in the future
Header set Content-Security-Policy "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
Header set Access-Control-Allow-Origin "*"
Header set Referer-Policy "unsafe-url"
AddType application/javascript .js

RewriteEngine On
# If an existing asset or directory is requested go to it as it is
RewriteBase /curatortool/

RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_URI} !^/assets/(.+)$
#RewriteRule ^schema_view/(.*)$ index.html [L]
RewriteRule ^(.*)$ index.html [L]
```

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Notes:

- the following version or configuration are important for compiling: "@langchain/openai": "^0.0.12" (March 14, 2024) in package.json and "skipLibCheck": true in tsconfig.json, // Based on to fix langchain issue:https://github.com/langchain-ai/langchainjs/issues/3793
- To build an angular component, follow https://www.telerik.com/blogs/angular-component-library-part-1-how-to-build. The pack is very important. Otherwise, it will not work! To install the component from reactome's ngx project, use: npm i {path_to_the_component} (e.g. ../ngx-reactome-base/dist/ngx-reactome-diagram/ngx-reactome-diagram-0.0.16.tgz). Note: make sure the version updated. Otherwise, the loaded library will not be updated in the chrome debug!!!
