def call(String file_name){
        
        echo "Version logic function"
        version = readFile(file_name)
        echo "${version}"
        versions = version.split('\\.')
        major = versions[0]
        minor = versions[1]
        micro = versions[2]
        patch = major + '.' + minor + '.' + micro + '.' + "${env.BUILD_NUMBER}"


        return patch

}

/* Usage:
versionLogic(
   "VERSION"
) */