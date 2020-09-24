def call(Map param){

    echo "Docker build Running...and image name is ${param.imageName}"
    dockerImage = docker.build("${param.imageName}")
    docker.withRegistry('', param.dockerCredential){
    dockerImage.push()
    echo "Docker image pushed successfully...."

    if(param.pushWithTag != null){
        dockerImage.push("${param.pushWithTag}")
        echo "Docker image with ${param.pushWithTag} tag pushed successfully...."
        }
    }

    sh "sudo docker rmi ${param.imageName}"

}
/* Usage:
dockerBuild(
    imageName: "${imageName}",
    dockerCredential: "qualitia-dockerhub-creds"
) */