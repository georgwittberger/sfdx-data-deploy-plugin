import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { readJsonSync } from 'fs-extra';
import * as path from 'path';
import { DataBulkUpsertCommand } from 'salesforce-alm/dist/commands/force/data/bulk/upsert';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  'sfdx-data-deploy-plugin',
  'datadeploy-deploy'
);

/**
 * Command to deploy data from CSV files to a Salesforce org
 */
export default class DataDeployDeploy extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    '$ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com'
  ];

  protected static flagsConfig = {
    deploydir: flags.directory({
      char: 'd',
      description: messages.getMessage('deploydirFlagDescription')
    }),
    waitperobject: flags.minutes({
      char: 'w',
      description: messages.getMessage('waitperobjectFlagDescription')
    })
  };

  protected static requiresUsername = true;
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    const deployDir = this.getDeployDir();
    this.log(messages.getMessage('infoDeployDir', [deployDir]));

    const deployFile = path.resolve(deployDir, 'datadeploy.json');
    this.log(messages.getMessage('infoDeployFile', [deployFile]));

    let deployConfig: DeployConfig;
    try {
      deployConfig = readJsonSync(deployFile) as DeployConfig;
    } catch (error) {
      throw new SfdxError(
        messages.getMessage('errorDeployFileNotReadable', [deployFile])
      );
    }

    for (const job of deployConfig.jobs) {
      const csvFile = path.resolve(deployDir, job.csvFile);
      const waitTimeout = this.getJobWaitTimeout(job);
      this.log(
        messages.getMessage('infoDeployDataFromFile', [
          job.sObjectName,
          csvFile,
          waitTimeout
        ])
      );

      try {
        await DataBulkUpsertCommand.run([
          `--targetusername=${this.org.getUsername()}`,
          `--sobjecttype=${job.sObjectName}`,
          `--externalid=${job.externalIdField}`,
          `--csvfile=${csvFile}`,
          `--wait=${waitTimeout}`
        ]);
      } catch (error) {
        throw new SfdxError(
          messages.getMessage('errorDeployDataFailed', [
            job.sObjectName,
            error.description
          ])
        );
      }
    }

    this.log(messages.getMessage('infoDeployCompleted', [deployDir]));
    return {};
  }

  private getDeployDir(): string {
    return this.flags.deploydir && path.isAbsolute(this.flags.deploydir)
      ? this.flags.deploydir
      : path.resolve(process.cwd(), this.flags.deploydir || '');
  }

  private getJobWaitTimeout(jobConfig: JobConfig): number {
    return this.flags.waitperobject ? this.flags.waitperobject.minutes : 5;
  }
}

/**
 * Deployment descriptor format
 */
interface DeployConfig {
  /**
   * Array of Bulk API job configurations
   */
  jobs: JobConfig[];
}

/**
 * Bulk API job configuration
 */
interface JobConfig {
  /**
   * Name of the Salesforce object
   */
  sObjectName: string;
  /**
   * Name of the field used to match existing records
   */
  externalIdField: string;
  /**
   * Relative path to the CSV file containing the data
   */
  csvFile: string;
}
