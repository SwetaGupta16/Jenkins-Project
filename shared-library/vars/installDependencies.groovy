def call(String location="."){

        sh "node --version"
        sh "npm --version"
        sh "npm --prefix ./${location} install"
}
/* Usage:
installDependencies() 
*/