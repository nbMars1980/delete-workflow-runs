async function run() {
  const core = require("@actions/core");
  try {
    // Fetch all the inputs
    const token = core.getInput('token');
    const repository = core.getInput('repository');
    const retain_days = core.getInput('retain_days');
    const keep_minimum_runs = core.getInput('keep_minimum_runs');    
    const repo_workflow_name = core.getInput('workflow_name');
    var repo_workflow_id = core.getInput('workflow_file_name');
    
    // Split the input 'repository' (format {owner}/{repo}) to be {owner} and {repo}
    const splitRepository = repository.split('/');
    if (splitRepository.length !== 2 || !splitRepository[0] || !splitRepository[1]) {
      throw new Error(`Invalid repository '${repository}'. Expected format {owner}/{repo}.`);
    }
    const repo_owner = splitRepository[0];
    const repo_name = splitRepository[1];
    
    
    var page_number = 1;
    var del_runs = new Array();
    const { Octokit } = require("@octokit/rest");
    const octokit = new Octokit({ auth: token });

    if(repo_workflow_id == "")
    {
      while (true) {
        // Execute the API "List workflow runs for a repository", see 'https://octokit.github.io/rest.js/v18#actions-list-repo-workflows'
        const response = await octokit.actions.listRepoWorkflows({
          owner: repo_owner,
          repo: repo_name,
          per_page: 100,
          page: page_number
        });
        const workflows = response.data.workflows.length;
        
        if (workflows < 1) {
          break;
        }
        else {
          for (index = 0; index < workflows; index++) {          
            if (repo_workflow_name == response.data.workflows[index].name){
              repo_workflow_id = response.data.workflows[index].id;
              break;
            }
          }
        }        
        if (workflows < 100) {
          break;
        }
        page_number++;
      }
    }
    //console.log(repo_workflow_id);
    page_number = 1;
    while (true) {
      // Execute the API "List workflow runs for a repository", see 'https://octokit.github.io/rest.js/v18#actions-list-workflow-runs-for-repo'     
      //const response = await octokit.actions.listWorkflowRunsForRepo({
      const response = await octokit.actions.listWorkflowRuns({
        owner: repo_owner,
        repo: repo_name,
        workflow_id: repo_workflow_id,
        per_page: 100,
        page: page_number
      });
      //console.log(response.data.workflow_runs[0].name)
      const lenght = response.data.workflow_runs.length;
      
      if (lenght < 1) {
        break;
      }
      else {
        for (index = 0; index < lenght; index++) {
          var created_at = new Date(response.data.workflow_runs[index].created_at);
          var current = new Date();
          var ELAPSE_ms = current.getTime() - created_at.getTime();
          var ELAPSE_days = ELAPSE_ms / (1000 * 3600 * 24);
          
          if (ELAPSE_days >= retain_days) {
            del_runs.push(response.data.workflow_runs[index].id);
          }
        }
      }
      
      if (lenght < 100) {
        break;
      }
      page_number++;
    }

    const arr_length = del_runs.length - keep_minimum_runs;
    if (arr_length < 1) {
      console.log(`No workflow runs need to be deleted.`);
    }
    else {
      for (index = del_runs.length - 1; index >= keep_minimum_runs; index--) {
        // Execute the API "Delete a workflow run", see 'https://octokit.github.io/rest.js/v18#actions-delete-workflow-run'
        const run_id = del_runs[index];
        await octokit.actions.deleteWorkflowRun({
          owner: repo_owner,
          repo: repo_name,
          run_id: run_id
        });

        console.log(`🚀 Delete workflow run ${run_id}`);
      }

      console.log(`✅ ${arr_length} workflow runs are deleted.`);
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
