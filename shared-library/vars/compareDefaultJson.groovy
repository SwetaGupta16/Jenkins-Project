def call(Map param){

        echo "inside compare json"
        def outfile = 'stdout.out'
        def status= sh(script: "comparejson ${param.old_file} ${param.new_file} > ${outfile} 2>&1", returnStdout: true).trim() 
        sh "cat stdout.out"
        def output = readFile(outfile).trim()
        echo "$output;"
        if (output.indexOf("No errors found") > 0){
            echo "Job Successful"
            sh "exit 0"
        }
        else{
            echo "Job Failed"
            sh "exit 1"      
            sh "echo if else ends" 
        }

}
/* Usage:
compareDefaultJson(
    old_file: "config/default.json",
    new_file: "default.json"         
) */