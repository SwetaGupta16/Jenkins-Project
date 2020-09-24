def call() {
    withCredentials([usernamePassword(
            credentialsId: "dockercreds",
            usernameVariable: "USER",
            passwordVariable: "PASS"
    )]) {
        sh "docker login -u $USER -p $PASS"
    }
}