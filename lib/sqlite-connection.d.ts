import { Field, ModelClass } from "mythix-orm";
import { SQLConnectionBase } from "mythix-orm-sql-base";
import { GenericObject } from "mythix-orm/lib/interfaces/common";

declare class SQLiteConnection extends SQLConnectionBase {
  public formatResultsResponse(sqlStatement: string, columns: Array<GenericObject>, result: Array<any>): { rows: Array<any>, columns: Array<string> };
  public getEmulatedAutoIncrementID(Model: ModelClass, field?: Field): number;
  public resetEmulatedAutoIncrementID(Model: ModelClass, field?: Field): void;
  public pragma(sql: string): Promise<any>;

  declare public emulatedAutoIncrementIDs: Map<ModelClass, Map<Field, number>>;
}

export default SQLiteConnection;
