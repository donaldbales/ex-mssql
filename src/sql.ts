/*
  sql.ts
  by Don Bales
  on 2018-12-21
  A library to connect, execute DLL and DML against SQL Server
*/

/* tslint:disable:no-console */

import { Connection, ConnectionConfig, ConnectionError } from 'tedious';

// import * as _ from 'lodash';
import * as fs from 'fs';
import * as tds from 'tedious';
import * as util from 'util';

// I create this abstraction in case we want to use a different logger like bunyan
const loggur: any = {
  // debug: debug.toLowerCase().indexOf('sqlserver') > -1 ? console.log : (msg: any) => { return; },
  debug: console.log,
  // error: (msg: any) => { emailer.send(msg, 'ACS ETL Job Error'); console.error(msg); },
  error: console.error,
  info: console.log,
  trace: console.log
};

const moduleName: string = 'index';

// I create this function to make it easy to develop and debug
function inspect(obj: any, depth: number = 5) {
  return util.inspect(obj, true, depth, false);
}

export function connect(logger: any): Promise<any> {
  const methodName: string = 'connect';

  return new Promise((resolve, reject) => {

    logger.info(`${moduleName}#${methodName}: started.`);

    const config: any = process.env.DOCTOSQL_RDBMS ? JSON.parse(process.env.DOCTOSQL_RDBMS) : {};
    const database: string = config.database;
    const password: string = config.password;
    const server: string = config.server;
    const userName: string = config.userName;
    const connectTimeout: number = (config.connectTimeout !== undefined) ?
      Number.parseInt(config.connectTimeout, 10) : 500000; // five minutes
    const requestTimeout: number = (config.requestTimeout !== undefined) ?
      Number.parseInt(config.requestTimeout, 10) : 86399997; // almost 24 hours
    const port: number = (config.port !== undefined) ?
      Number.parseInt(config.port, 10) : 1433;

    const connectionConfig: tds.ConnectionConfig = {
      authentication: {
        options: {
          password,
          userName
        },
        type: 'default'
      },
      options: {
        connectTimeout,
        database,
        // If you're on Windows Azure, you will need this:
        encrypt: true,
        port,
        requestTimeout
      },
      server
    };
    
    const connection: Connection = new Connection(connectionConfig);

    connection.on('error', (err: any) => {
      const error: any = err;
      console.error(`${moduleName}#${methodName}: ${inspect(error)}`);
      setTimeout(() => {
        process.exit(99);
      }, 5000);
    });

    connection.on('connect', (err: any) => {
      if (err) {
        const error: any = err;
        console.error(`${moduleName}#${methodName}: ${inspect(error)}`);
        return reject({ error });
      } else {
        return resolve(connection);
      }
    });
  });
}

export function executeDDL(logger: any, conn: any, sql: string): Promise<any> {
  const methodName: string = 'executeDDL';

  return new Promise((resolve, reject) => {
    logger.info(`${moduleName}, ${methodName}: start`);

    const results: any[] = [];

    if (sql) {
      const sqlRequest = new tds.Request(
        sql,
        (sqlerr: any, rowCount: any) => {
          if (sqlerr) {
            logger.error(`${moduleName}, ${methodName} \n${inspect(sqlerr)}`);
            return reject({ error: sqlerr });
          } else {
            logger.info(`${moduleName}, ${methodName}: ${rowCount} rows`);
          }
        });

      logger.info(`${moduleName}, ${methodName}: sql=\n${sql}`);

      sqlRequest.on('row', (columns: any) => {
        logger.debug(`${moduleName}, ${methodName}: on row, columns=${inspect(columns)}`);
        results.push({ value: columns[0].value });
      });

      sqlRequest.on('requestCompleted', () => {
        logger.debug(`${moduleName}, ${methodName} on requestCompleted`);
        return resolve(results);
      });

      conn.execSql(sqlRequest);
    } else {
      resolve(results);
    }
  });
}

export function executeDML(logger: any, conn: any, sql: string, params: any[] = []): Promise<any> {
  const methodName: string = 'executeDML';

  return new Promise((resolve, reject) => {
    logger.info(`${moduleName}, ${methodName}: start`);

    const results: any[] = [];
    let rowsAffected: number = 0;

    if (sql) {
      const sqlRequest = new tds.Request(
        sql,
        (sqlerr: any, rowCount: any) => {
          if (sqlerr) {
            // logger.error(`${moduleName}, ${methodName} error: \n${inspect(sqlerr)}`);
            return reject({ error: sqlerr });
          } else {
            rowsAffected = rowCount;
            logger.info(`${moduleName}, ${methodName}: ${rowCount} rows`);
          }
        });

      logger.info(`${moduleName}, ${methodName}: sql=\n${sql}`);

      if (params &&
          params.length > 0) {
        for (const param of params) {
          sqlRequest.addParameter(param[0], tds.TYPES.VarChar, param[1]);
        }
      }

      sqlRequest.on('row', (columns: any) => {
        // logger.debug(`${moduleName}, ${methodName}: on row`);

        const result: any = {};
        for (const column of columns) {
          // logger.debug(`${moduleName}, ${methodName}: column_name=${column.metadata.colName}`);
          // logger.debug(`${moduleName}, ${methodName}: value=${inspect(column.value)}`);
          // logger.debug(`${moduleName}, ${methodName}: javascript type=${typeof column.value}`);
          // logger.debug(`${moduleName}, ${methodName}: tds type=${column.metadata.type.name}`);
          let value: any;

          switch (column.metadata.type.name) {
          case 'BigInt':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'Bit':
            value = column.value !== null ? column.value : null;
            break;
          case 'BitN':
            value = column.value !== null ? column.value : null;
            break;
          case 'Date':
            value = column.value !== null ? new Date(column.value.toString()) : null;
            break;
          case 'DateTime':
            value = column.value !== null ? new Date(column.value.toString()) : null;
            break;
          case 'DateTime2':
            value = column.value !== null ? new Date(column.value.toString()) : null;
            break;
          case 'DateTimeN':
            value = column.value !== null ? new Date(column.value.toString()) : null;
            break;
          case 'DateTimeOffset':
            value = column.value !== null ? new Date(column.value.toString()) : null;
            break;
          case 'DecimalN':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'FloatN':
            value = column.value !== null ? column.value : null;
            break;
          case 'Int':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'IntN':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'NumericN':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'SmallInt':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'VarBinary':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'NVarChar':
            value = column.value !== null ? column.value.toString() : null;
            break;
          case 'VarChar':
            value = column.value !== null ? column.value.toString() : null;
            break;
          default:
            value = column.value !== null ? column.value.toString() : null;
            logger.error(`${moduleName}, ${methodName}: ` +
              `Unsupported data type: ` +
              `column name=${column.metadata.colName}, ` +
              `tds type=${column.metadata.type.name}`);
          }
          result[column.metadata.colName] = value;
        }
        results.push(result);
      });

      sqlRequest.on('requestCompleted', () => {
        logger.debug(`${moduleName}, ${methodName} on requestCompleted`);
        if (results.length === 0) {
          results.push({ rowsAffected });
        }
        return resolve(results);
      });

      conn.execSql(sqlRequest);
    } else {
      resolve(results);
    }
  });
}

// Log the start of a job
export async function insertEtlJobHistory(logger: any, conn: any, jobName: string): Promise<any> {
  const methodName: string = 'insertEtlJobHistory';
  logger.info(`${moduleName}, ${methodName}: start`);
  const startDate: string = new Date().toISOString();
  const sql: string = `insert into ETL_JOB_HISTORY (JOB_NAME, START_DATE) output INSERTED.ID values (@JOB_NAME, '${startDate}')`;
  const params: any[] = [['JOB_NAME', jobName]];
  let results: any = null;
  try {
    results = await executeDML(logger, conn, sql, params);
    logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
  } catch (err) {
    logger.error(`${moduleName}, ${methodName}: ${err}`);
    process.exit(1);
  }
  return results[0].ID;
}

// Get the last update date for the underlying dataset, for the last successful job
export async function selectEtlJobHistory(logger: any, conn: any, jobName: string): Promise<any> {
  const methodName: string = 'selectEtlJobHistory';
  logger.info(`${moduleName}, ${methodName}: start`);
  const stopDate: string = new Date().toISOString();
  const sql: string = `
    select max(s1.LAST_UPDATE_DATE) last_update_date
    from   ETL_JOB_HISTORY s1
    where  s1.JOB_NAME = @JOB_NAME
    and    s1.START_DATE = (
      select max(s2.START_DATE)
      from   ETL_JOB_HISTORY s2
      where  s2.JOB_NAME = @JOB_NAME
      and    s2.END_DATE is not NULL)
    and    s1.END_DATE is not NULL`;
  const params: any[] = [['JOB_NAME', jobName]];
  let results: any = null;
  try {
    results = await executeDML(logger, conn, sql, params);
    logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
  } catch (err) {
    logger.error(`${moduleName}, ${methodName}: ${err}`);
    process.exit(1);
  }
  let result: string = '1900-01-01T00:00:00Z';
  if (results &&
      results instanceof Array &&
      results.length === 1 &&
      results[0].last_update_date &&
      results[0].last_update_date instanceof Date) {
    result = results[0].last_update_date.toISOString().slice(0, 19) + 'Z';
  }
  logger.info(`${moduleName}, ${methodName}: result=${result}`);
  return result;
}

// Get the last update date for the specifued dataset
export async function selectLastUpdateDate(logger: any, conn: any, table: string, column: string): Promise<any> {
  const methodName: string = 'selectLastUpdateDate';
  logger.info(`${moduleName}, ${methodName}: start`);
  const stopDate: string = new Date().toISOString();
  const sql: string = `select max(${column.toLocaleUpperCase()}) last_update_date from ${table.toLocaleUpperCase()}`;
  const params: any[] = [];
  let results: any = null;
  try {
    results = await executeDML(logger, conn, sql, params);
    logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
  } catch (err) {
    logger.error(`${moduleName}, ${methodName}: ${err}`);
    process.exit(1);
  }
  let result: string = '1900-01-01T00:00:00Z';
  if (results &&
      results instanceof Array &&
      results.length === 1 &&
      results[0].last_update_date &&
      results[0].last_update_date instanceof Date) {
    const thirtyOneDays: number = 31 * 24 * 60 * 60 * 1000;
    const lastUpdateDate: Date = new Date(results[0].last_update_date.getTime() - thirtyOneDays);
    result = lastUpdateDate.toISOString().slice(0, 19) + 'Z';
  }
  logger.info(`${moduleName}, ${methodName}: result=${result}`);
  return result;
}

// Log the end of a successful job
export async function updateEtlJobHistory(
  logger: any, conn: any, id: string, table: string = '', column: string = ''): Promise<any> {
  const methodName: string = 'updateEtlJobHistory';
  logger.info(`${moduleName}, ${methodName}: start`);
  let lastUpdateDate: string = '1900-01-01T00:00:00Z';
  if (table && column) {
    lastUpdateDate = await selectLastUpdateDate(logger, conn, table, column);
  }
  const endDate: string = new Date().toISOString();
  const sql: string = `update u set u.REV = u.REV + 1, ` +
    `u.END_DATE = '${endDate}', u.LAST_UPDATE_DATE = '${lastUpdateDate}' ` +
    `from ETL_JOB_HISTORY u where u.ID = @ID`;
  const params: any[] = [['ID', id]];
  let results: any = null;
  try {
    results = await executeDML(logger, conn, sql, params);
    logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
  } catch (err) {
    logger.error(`${moduleName}, ${methodName}: ${err}`);
    process.exit(1);
  }
  return results[0].rowsAffected;
}

// A main method with no command line parameter management
async function main(): Promise<any> {
  const methodName: string = 'main';
  loggur.info({ moduleName, methodName }, `Starting...`);

  const conn: any = await connect(loggur);

  const lastStartDate: Date = await selectEtlJobHistory(loggur, conn, 'sqlserver');

  loggur.info({ moduleName, methodName, lastStartDate });

  const id: string = await insertEtlJobHistory(loggur, conn, 'sqlserver');

  loggur.info({ moduleName, methodName, id });

  const result: any[] = await updateEtlJobHistory(loggur, conn, id);

  loggur.info({ moduleName, methodName, result });

  if (require.main === module) {
    setTimeout(() => { process.exit(0); }, 10000);
  }

  loggur.info({ moduleName, methodName }, `Ending.`);
}

// Start the program
if (require.main === module) {
  main();
}
