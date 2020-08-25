// index.ts

import * as bunyan from 'bunyan';
import Logger from 'bunyan';
import * as fs from 'fs';
import * as minimist from 'minimist';
import { Connection } from 'tedious';
import * as util from 'util';

import * as sql from './sql';

let logger: Logger;
const moduleName: string = 'index';
const possibleTasks: any[] = [
  'counts',
  'descs',
  'histograms',
  'search'
];

// I create this function to make it easy to develop and debug
function inspect(obj: any, depth: number = 7) {
  return util.inspect(obj, true, depth, false);
}

function argz(args: any = null): any {
  const methodName: string = 'argz';

  // console.error(`${moduleName}#${methodName}: Starting...`);
  // console.error(inspect(args)); 
  // console.error(inspect(process.argv.slice(2)));

  const localArgs = minimist(args && args.length > 0 ? args : process.argv.slice(2), {
    alias: {
      h: 'help',
      l: 'like',
      p: 'parameter',
      s: 'search',
      t: 'tasks',
      v: 'version'
    },
    default: {
      t: possibleTasks.join(',')
    }
  });
  const pkg: any  = JSON.parse(fs.readFileSync('package.json').toString());
  const name: string = pkg.name ? pkg.name : '';
  const version: string = pkg.version ? pkg.version : '';
  if (localArgs.version) {
    console.log(`${version}`);
    process.exit(0);
  }
  if (localArgs.help) {
    console.log(`Usage: node src/index [options]\n`);
    console.log(`Options:`);
    console.log(`  -h, --help     print ${name} command line options`);
    console.log(`  -t, --tasks    specify task(s) to run: ${possibleTasks.join(', ')}.`);
    console.log(`  -v, --version  print ${name} version`);
    process.exit(0);
  }
  const like: boolean = localArgs.like ? true : false;
  const search: string = localArgs.search;
  const parameter: string = localArgs.parameter ? localArgs.parameter.toString() : '';
  const result: any = { like, search, tasks: {}, parameter };
  const tasks: any[] = localArgs.tasks.split(',');
  // console.error(tasks);
  for (const task of tasks) {
    let found: boolean = false;
    for (const possibleTask of possibleTasks) {
      if (possibleTask === task) {
        found = true;
        break;
      }
    }
    if (found) {
      result.tasks[task] = true;
    } else {
      console.error(`Task: ${task}, is not in the list of supported tasks: ${possibleTasks.join(', ')}.`);
      setTimeout(() => { process.exit(1); }, 10000);
    }
  }
  return result;
}

async function databases(logger: Logger, conn: Connection): Promise<any> {
  let results: any = [];

  const query: string = `
    SELECT name 
    FROM   master.dbo.sysdatabases 
    WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
/*    AND   name like 'H70_%'
    AND   name != 'H70_AUDITTRAIL' */
    ORDER BY 1`;

  try {
    results = await sql.executeDML(logger, conn, query, []);
  } catch (err) {
    logger.error({ err });
    process.exit(99);
  }

  return results;
}
  
async function tablesAndColumns(logger: Logger, conn: Connection): Promise<any> {
  let results: any = [];

  const query: string = `
    select TABLE_SCHEMA,
           TABLE_NAME,
           COLUMN_NAME
    from   INFORMATION_SCHEMA.COLUMNS
    where  DATA_TYPE != 'image'
    order by 1, 2, 3
  `;

  try {
    results = await sql.executeDML(logger, conn, query, []);
  } catch (err) {
    logger.error({ err });
    process.exit(99);
  }

  return results;
}

async function tablesAndIDColumns(logger: Logger, conn: Connection): Promise<any> {
  let results: any = [];

  const query: string = `
      select TABLE_SCHEMA,
             TABLE_NAME,
             COLUMN_NAME
      from   INFORMATION_SCHEMA.COLUMNS
      where (lower(COLUMN_NAME) like '%_id'
      or     lower(COLUMN_NAME) = 'sku')
      order by 1, 2, 3
    `;

  try {
    results = await sql.executeDML(logger, conn, query, []);
  } catch (err) {
    logger.error({ err });
    process.exit(99);
  }

  return results;
}

async function tablesAndStringColumns(logger: Logger, conn: Connection): Promise<any> {
  let results: any = [];

  const query: string = `
      select TABLE_SCHEMA,
             TABLE_NAME,
             COLUMN_NAME
      from   INFORMATION_SCHEMA.COLUMNS
      where  DATA_TYPE in ('binary', 'varbinary', 'char', 'nchar', 'ntext', 'text', 'nvarchar', 'varchar')
      order by 1, 2, 3
    `;

  try {
    results = await sql.executeDML(logger, conn, query, []);
  } catch (err) {
    logger.error({ err });
    process.exit(99);
  }

  return results;
}

async function counts(logger: Logger, conn: Connection, tables: any): Promise<any> {
  const results: any = { tables: {} }; 

  let i: number = 0;
  for (const tableName of tables.keys()) {
    let query: string;
    query = `select count(1) "count" from ${tableName}`;

    console.error(query);

    try {
      const rows: any = await sql.executeDML(logger, conn, query, []);
      // console.error(rows);
      for (const row of rows) {
        if (row.count && row.count.toString) {
          const count: string = `${row.count.toString().trimRight()}`;
          results.tables[tableName] = count;
        }
      }
    } catch (err) {
      // console.error(inspect(err));
      results.tables[tableName] = err.error.message;
    }
  }
  return results;
}

async function descs(logger: Logger, conn: Connection, tables: any): Promise<any> {
  const results: any = { tables: {} }; 

  let i: number = 0;
  for (const tableName of tables.keys()) {
    let query: string;
    query = `sp_help "${tableName}";`;

    console.error(`\n${query}`);

    try {
      const rows: any = await sql.executeDML(logger, conn, query, []);
      // console.log(`rows=${inspect(rows)}`);
      
      let desc: string = '';
      for (const row of rows) {
        console.log(row);
        desc += `${row}\n`; 
      }
      results.tables[tableName] = desc;
    } catch (err) {
      console.error(`err=${inspect(err)}`);
      results.tables[tableName] = err.error.message;
    }
    // break;
  }
  return results;
}

async function histograms(logger: Logger, conn: Connection, tables: any): Promise<any> {  
  const results: any = { tables: {} }; 

  for (const tableName of tables.keys()) {
    console.error(`/** ${tableName} */`);
    
    results.tables[tableName] = [];

    for (const columnName of tables.get(tableName)) {
      console.error(`/*** ${columnName} */`);
      
      if (columnName === 'next_val') {
        continue;
      } else
      if (tableName === 'H70_AUDITTRAIL.dbo.sysdiagrams' &&
          columnName === 'definition') {
        continue;
      }

      let query: string;
      query = `
        select top(100)
               cast([${columnName}] as varchar(80)) "${columnName}", 
               count(1) "count" 
        from   ${tableName} 
        group by cast([${columnName}] as varchar(80)) 
        order by count(1) desc
      `;

      console.error(query);

      try {
        const rows: any = await sql.executeDML(logger, conn, query, []);
        
        for (const row of rows) {
          if (row.count && row.count.toString) {
            results.tables[tableName].push(row);
          }
        }
      } catch (err) {
        results.tables[tableName].push(err.error.message);
      }
      // break;
    }  
    // break;
  }
  return results;
}

/*
async function ids(conn: any, tables: any): Promise<any> {
  const results: any = { ids: new Map() }; 

  let i: number = 0;
  for (const tableName of tables.keys()) {
    let sql: string;
    for (const columnName of tables.get(tableName)) {
      sql = `select distinct \`${columnName}\` as ID from ${database}.\`${tableName}\``;

      console.error(sql);

      const value: string = `${tableName}\t${columnName}`;
      try {
        const rows: any = await select(conn, sql);
        // console.error(rows);
        for (const row of rows) {
          if (row.ID && row.ID.toString) {
            const id: string = `"${row.ID.toString().trimRight()}"`;
            if (results.ids.has(id)) {
              if (!results.ids.get(id).has(value)) {
                results.ids.get(id).add(value);
              }
            } else {
              results.ids.set(id, new Set([ value ]));
            }
            // if (++i > 5) {
            //   break;
            // }
          }
        }
      } catch (err) {
        results.error = err;
        console.error(results.error);
        return results;
      }
    }
    // if (++i === 25) {
    //   break;
    // }
  }
  return results;
}
*/

async function search(logger: Logger, conn: Connection, tables: any, str: string = '', like: boolean = false): Promise<any> {
  const results: any = { rows: [] };

  for (const tableName of tables.keys()) {
    for (const columnName of tables.get(tableName)) {
      const label: string = `${tableName}.${columnName}`; 
      let query: string = `
        select count(1) "${label}"
        from   ${tableName}
        where  `;
/*
      query +=   `lower(cast(${columnName} as varchar(8000))) = '${str}'\n        or     `;
      if (like) {
        query += `lower(cast(${columnName} as varchar(8000))) like '${str} %'\n        or     `;
        query += `lower(cast(${columnName} as varchar(8000))) like '% ${str} %'\n        or     `;
        query += `lower(cast(${columnName} as varchar(8000))) like '% ${str}'\n        or     `;
      }
*/      
      query +=   `cast([${columnName}] as varchar(800)) = '${str}'\n        or     `;
      if (like) {
        query += `cast([${columnName}] as varchar(800)) like '${str}%'\n        or     `;
        query += `cast([${columnName}] as varchar(800)) like '%${str}%'\n        or     `;
        query += `cast([${columnName}] as varchar(800)) like '%${str}'\n        or     `;
      }
      query = query.slice(0, -15);
      console.error(query);

      try {
        const rows: any = await sql.executeDML(logger, conn, query, []);
        if (rows && rows.length > 0 && rows[0][label] > 0) {
          // console.log(rows[0][label]);
          results.rows = results.rows.concat(rows);
        }
      } catch (err) {
        results.error = err;
        console.error(results.error);
        return results;
      }
    }
  }
  return results;
}

export default async function main(...args: any[]): Promise<any> {
  const methodName: string = 'main';
  const logger: Logger = bunyan.createLogger({ "name": "ex-mysql" });
  logger.level('error');
  logger.info(`${moduleName}#${methodName}: Starting...`);

  let results: any;
  const cla: any = argz(args);
  const tasks: any = cla.tasks;
  
  let conn = null;  
  try {
    conn = await sql.connect(logger);
    logger.info(`${moduleName}#${methodName}: Connected...`);
  } catch (err) {
    logger.error(`${moduleName}#${methodName}: ${inspect(err)}`);
  }
  
/*  
  if (tasks.ids) {    
    results = await tablesAndIDColumns(conn);
    // console.log(results);
    let columnNames: any[];
    columnNames = [];
    let tableName: string;
    tableName = results.results[0].TABLE_NAME;
    const tables: Map<string, string[]> = new Map();
    for (const result of results.results) {
      if (tableName !== result.TABLE_NAME) {
        tables.set(tableName, columnNames);
        columnNames = [];
        tableName = result.TABLE_NAME;
      } 
      columnNames.push(result.COLUMN_NAME);
    }
    tables.set(tableName, columnNames);

    // console.log(tables);

    results = await ids(conn, tables);
    const keys: any[] = Array.from(results.ids.keys());
    keys.sort();
    // console.log(results);
    for (const key of keys) {
      // console.error(`id=${id.toString()}`);
      const values: any[] = Array.from(results.ids.get(key).values());
      values.sort();
      for (const value of values) {
        // console.error(`value=${value.toString()}`);
        console.log(`${key}\t${value}`);
      }
    }
  }
*/

  if (tasks.counts) {    
    console.log(`CATALOG.SCHEMA.TABLE\tCOUNT`);
    results = await databases(logger, conn);
    const tableCatalogs: any[] = [];
    for (const result of results) {
      tableCatalogs.push(result.name);
    }
    
    for (const tableCatalog of tableCatalogs) {
      results = await sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
      
      results = await tablesAndColumns(logger, conn);
      // console.log(results);
      // process.exit(1);
      let columnNames: any[];
      columnNames = [];
      let tableName: string;
      tableName = `${tableCatalog}.${results[0].TABLE_SCHEMA}.${results[0].TABLE_NAME}`;

      const tables: Map<string, string[]> = new Map();
      for (const result of results) {
        if (tableName !== result.TABLE_NAME) {
          tables.set(tableName, columnNames);
          columnNames = [];
          tableName = `${tableCatalog}.${result.TABLE_SCHEMA}.${result.TABLE_NAME}`;
        } 
        columnNames.push(result.COLUMN_NAME);
      }
      tables.set(tableName, columnNames);

      results = await counts(logger, conn, tables);
      // console.log(results);
      // process.exit(1);
      for (const property in results.tables) {
        if (results.tables.hasOwnProperty(property)) {
          console.log(`${property}\t${results.tables[property]}`);
        }
      }
    }
  }

  if (tasks.descs) {    
    results = await databases(logger, conn);
    const tableCatalogs: any[] = [];
    for (const result of results) {
      tableCatalogs.push(result.name);
    }
    
    for (const tableCatalog of tableCatalogs) {
      console.error(`\nselect '${tableCatalog}' TABLE_CATALOG;\n`);
      console.error(`\nuse ${tableCatalog};\n`);
      
      results = await sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
      
      results = await tablesAndColumns(logger, conn);
      // console.log(results);
      // process.exit(1);
      let columnNames: any[];
      columnNames = [];
      let tableName: string;
      tableName = `${tableCatalog}.${results[0].TABLE_SCHEMA}.${results[0].TABLE_NAME}`;

      const tables: Map<string, string[]> = new Map();
      for (const result of results) {
        if (tableName !== result.TABLE_NAME) {
          tables.set(tableName, columnNames);
          columnNames = [];
          tableName = `${tableCatalog}.${result.TABLE_SCHEMA}.${result.TABLE_NAME}`;
        } 
        columnNames.push(result.COLUMN_NAME);
      }
      tables.set(tableName, columnNames);

      results = await descs(logger, conn, tables);
    }
  }

  if (tasks.histograms) {    
    console.log(`CATALOG.SCHEMA.TABLE\tCOLUMN\tROW\tVALUE\tCOUNT`);
    try {
      results = await databases(logger, conn);
      logger.info(`${moduleName}#${methodName}: databases ${inspect(results)}`);
    } catch (err) {
      logger.info(`${moduleName}#${methodName}: databases error=${inspect(err)}`);
      process.exit(99);
    }
    const tableCatalogs: any[] = [];
    for (const result of results) {
      tableCatalogs.push(result.name);
    }
    
    for (const tableCatalog of tableCatalogs) {
      results = await sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
      
      results = await tablesAndColumns(logger, conn);
      
      let columnNames: any[] = [];
      let tableName: string = formatTableName(tableCatalog, results[0].TABLE_SCHEMA, results[0].TABLE_NAME);
      const tables: Map<string, string[]> = new Map();
      
      for (const result of results) {
        if (tableName !== formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME)) {
          tables.set(tableName, columnNames);
          columnNames = [];
          tableName = formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME);
        } 
        columnNames.push(result.COLUMN_NAME);
      }
      tables.set(tableName, columnNames);

      results = await histograms(logger, conn, tables);

      // console.log(inspect(results));
      // process.exit(1);

      for (const property in results.tables) {
        // console.log(`* ${property}`);
        
        if (results.tables.hasOwnProperty(property)) {          
          const tableName: string = property;
          let columnName: string = '';
          let columnValue: string = '';
          let count: string = '';
          let rowCount: number = 0;
          let lastColumnName: string = '';
          for (const row of results.tables[property]) {
            // console.log(`** ${inspect(row)}`);
            
            let property2Count: number = 0;
            for (const property2 in row) {
              // console.log(`*** ${property2}, i=${i}`);
              
              if (row.hasOwnProperty(property2)) {
                property2Count++;
                if (property2Count === 1) {
                  columnName = property2;
                  if (rowCount === 0) {
                    lastColumnName = columnName;
                  }
                  columnValue = row[property2];
                  if (lastColumnName !== columnName) {
                    lastColumnName = columnName;
                    rowCount = 0;
                  }
                  rowCount++;
                } else
                if (property2Count === 2) {
                  count = row[property2];
                }
              }
            } 
            console.log(`${tableName}\t${columnName}\t${rowCount}\t${columnValue}\t${count}`);
          }
        }
      }
    }
  }

  if (tasks.search) {    
    console.log(`CATALOG.SCHEMA.TABLE.COLUMN\tCOUNT`);
    results = await databases(logger, conn);
    const tableCatalogs: any[] = [];
    for (const result of results) {
      tableCatalogs.push(result.name);
    }
    
    for (const tableCatalog of tableCatalogs) {
      results = await sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
      
      // results = await tablesAndStringColumns(logger, conn);
      results = await tablesAndColumns(logger, conn);

        let columnNames: any[] = [];
        let tableName: string = formatTableName(tableCatalog, results[0].TABLE_SCHEMA, results[0].TABLE_NAME);
        const tables: Map<string, string[]> = new Map();

        for (const result of results) {
          if (tableName !== formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME)) {
            tables.set(tableName, columnNames);
            columnNames = [];
            tableName = formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME);
          } 
          columnNames.push(result.COLUMN_NAME);
        }
        tables.set(tableName, columnNames);

      // console.log(tables);
      // console.error(cla);
//      const localSearch: string = cla.search && cla.search.toLowerCase ? cla.search.toLowerCase() : '';
      let localSearch: string = cla.search;
      if (localSearch.trim) {
        localSearch = localSearch.trim();
      }
      results = await search(logger, conn, tables, localSearch, cla.like);
      // console.log(results);
      for (const row of results.rows) {
        let str: string = ``;
        for (const col in row) {
          str += `${col}\t${row[col]}\t`;
        }
        console.log(str);
      }
      // break;
    }
  }
  
  conn.close();
}

// Start the program
if (require.main === module) {
  main();
}

function formatTableName(catalog: string, schema: string, table: string): string {
  return `${catalog}.${schema}.${table}`;
}

/* https://docs.microsoft.com/en-us/previous-versions/sql/sql-server-2008/ms190785%28v%3dsql.100%29
[ { name: 'dbo', schema_id: '1', principal_id: '1' },
  { name: 'guest', schema_id: '2', principal_id: '2' },
  { name: 'INFORMATION_SCHEMA', schema_id: '3', principal_id: '3' },
  { name: 'sys', schema_id: '4', principal_id: '4' },
  { name: 'db_owner', schema_id: '16384', principal_id: '16384' },
  { name: 'db_accessadmin',
    schema_id: '16385',
    principal_id: '16385' },
  { name: 'db_securityadmin',
    schema_id: '16386',select 
    principal_id: '16386' },
  { name: 'db_ddladmin',
    schema_id: '16387',
    principal_id: '16387' },
  { name: 'db_backupoperator',
    schema_id: '16389',
    principal_id: '16389' },
  { name: 'db_datareader',
    schema_id: '16390',
    principal_id: '16390' },
  { name: 'db_datawriter',
    schema_id: '16391',
    principal_id: '16391' },
  { name: 'db_denydatareader',
    schema_id: '16392',
    principal_id: '16392' },
  { name: 'db_denydatawriter',
    schema_id: '16393',
    principal_id: '16393' } ]
  query = 'select * from sys.schemas';
  
  query = 'use PIM_MAIN;';

    query = 'select @@VERSION;';
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = 'select db_name();';
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = 'select current_user;';
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = `select * from sys.fn_my_permissions(NULL, 'SERVER');`;
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = `select * from sys.fn_my_permissions(NULL, 'DATABASE');`;
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = `SELECT HAS_PERMS_BY_NAME(db_name(), 'DATABASE', 'ANY');`;
    query = `
SELECT db_name(),p.name as UserName, p.type_desc as TypeOfLogin, pp.name as PermissionLevel, pp.type_desc as TypeOfRole 
FROM sys.database_role_members roles
JOIN sys.database_principals p ON roles.member_principal_id = p.principal_id
JOIN sys.database_principals pp ON roles.role_principal_id = pp.principal_id
where p.name = current_user
`;
    query = 
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    query = `
    select TABLE_NAME,
           COLUMN_NAME
    from   INFORMATION_SCHEMA.COLUMNS
    order by 1, 2
  `;
    query = `select TABLE_CATALOG, count(1) OCCURS from INFORMATION_SCHEMA.TABLES group by TABLE_CATALOG`;
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    results = await sql.executeDML(logger, conn, 'sp_help "INFORMATION_SCHEMA.COLUMNS";', []);
    console.log(results);

*/