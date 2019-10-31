export interface DeploymentConfig {
  jobs: JobConfig[];
}

export interface JobConfig {
  sObjectApiName: string;
  dataFileName: string;
  deployConfig?: JobDeployConfig;
  retrieveConfig?: JobRetrieveConfig;
}

export interface JobDeployConfig {
  externalIdFieldApiName?: string;
  maxWaitMinutes?: number;
}

export interface JobRetrieveConfig {
  fieldApiNames: string[];
  filterPredicate?: string;
}
