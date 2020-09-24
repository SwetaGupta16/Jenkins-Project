// Hello world
// #!/usr/bin/env groovy
// import org.main.qds.HelloWorld


// def call(String text)
// {
//     def helloworld = new HelloWorld();
//     println "In var function" + text
//     helloworld.hello(text);
// }

def call(){

    println "Hello from shared library";
    
}
// def call(Map stageParams) {
 
//     checkout([
//         $class: 'GitSCM',
//         branches: [[name:  stageParams.branch ]],
//         userRemoteConfigs: [[ url: stageParams.url ]]
//     ])
//   }