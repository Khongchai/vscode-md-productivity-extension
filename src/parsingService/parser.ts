import { Diagnostic, DiagnosticSeverity, Range } from "vscode";
import { CharacterCodes } from "../constants";
import DateUtil from "../utils";
import { DaySettings, Token } from "./types";
import { DiagnosticsTokenizer } from "./tokenizer";

/**
 * To prevent confusion, Date in string xx/xx/xxxx format is assumed to have its month
 * starting at 1, like normal people.
 *
 * The Date object itself can be weird and have its month starting at 00
 */
export class DiagnosticsParser {
  private readonly _settings: DaySettings;
  private _today: Date;
  private _isUsingControllledDate: boolean;
  private _tokenizer: DiagnosticsTokenizer;

  constructor({
    daySettings: settings,
    today,
  }: {
    daySettings?: DaySettings;
    today?: Date;
  }) {
    this._today = today ?? DateUtil.getDate();
    this._isUsingControllledDate = !!today;
    this._settings = settings ?? {
      critical: 2,
      deadlineApproaching: 4,
      shouldProbablyBeginWorkingOnThis: 7,
    };
    this._tokenizer = new DiagnosticsTokenizer();
  }

  /**
   * Parses for new diagnostics + update the date.
   */
  parse(text: string): Diagnostic[] {
    this._tokenizer.reset();

    const diagnostics: Diagnostic[] = [];
    if (!this._isUsingControllledDate) {
      this._today = DateUtil.getDate();
    }

    for (const token of this._tokenizer.tokenize(text)) {
      switch (token) {
        case Token.date:
          const date = this._getDate(this._tokenizer.getText());
          const diagnostic = this._checkDiagnosticSeverity(date);
          if (diagnostic) {
            const range = new Range(
              this._tokenizer.getLine(),
              this._tokenizer.getLineOffset() -
                this._tokenizer.getText().length,
              this._tokenizer.getLine(),
              this._tokenizer.getLineOffset()
            );
            diagnostics.push({
              range,
              message: diagnostic.message,
              severity: diagnostic.sev,
            });
          }
          continue;
        case Token.newLine:
        case Token.lineEnd:
          continue;
      }
    }

    return diagnostics;
  }

  private _getDate(dateString: string): Date {
    const [dd, mm, yyyy] = dateString.split("/");
    const _dd = parseInt(dd);
    const _mm = parseInt(mm);
    const _yyyy = parseInt(yyyy);
    const date = DateUtil.getDateLikeNormalPeople(_yyyy, _mm, _dd);
    if (!date.valueOf()) {
      // TODO throw parsing error, invalid date.
    }

    if (_dd > 31) {
      // TODO Throw invalid day
    }

    // month starts at 0
    if (_mm > 11) {
      // throw error invalid month (throw at the correct spot)
    }

    if (_yyyy < this._today.getFullYear()) {
      // throw error time traveller from the past!
    }

    return date;
  }

  private _checkDiagnosticSeverity(
    date: Date
  ): { sev: DiagnosticSeverity; message: string } | null {
    const diff = date.getTime() - this._today.getTime();
    const diffDays = Math.floor(diff / 1000 / 60 / 60 / 24);
    const { critical, deadlineApproaching, shouldProbablyBeginWorkingOnThis } =
      this._settings;
    if (diffDays < 0) {
      return {
        sev: DiagnosticSeverity.Error,
        message: "This is overdue!",
      };
    }
    if (diffDays < critical) {
      return {
        sev: DiagnosticSeverity.Warning,
        message: `Deadline is only like ${diffDays} days away!`,
      };
    }
    if (diffDays < deadlineApproaching) {
      return {
        sev: DiagnosticSeverity.Information,
        message: "The deadline is approaching.",
      };
    }
    if (diffDays < shouldProbablyBeginWorkingOnThis) {
      return {
        sev: DiagnosticSeverity.Hint,
        message: "If you haven't already, start working on this.",
      };
    }

    return null;
  }
}