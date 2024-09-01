import * as vscode from "vscode";
import DateUtil from "../parsingService/dateUtils";
import { DateParsedEvent, ParserVisitor } from "../parsingService/parser";
import { DeadlineSection } from "../parsingService/todoSection";

const decorationMap: Record<string, vscode.TextEditorDecorationType> = {};

function addDecoration(...args: Parameters<DateParsedEvent>) {
  // A quick hack to make sure that the decorations are applied after the section is updated.
  // There are many other more elegant solutions, but this works and I'm tired, it's getting late.
  queueMicrotask(() => {
    const [section, line, lineEnd] = args satisfies [
      DeadlineSection,
      number,
      number
    ];
    const diffDays = DateUtil.getDiffInDays(
      section.getDate(),
      DateUtil.getDate()
    );

    // There can only be one date per line, so we're safe.
    if (!decorationMap[line]) {
      const decoration = vscode.window.createTextEditorDecorationType({
        after: {
          color: "#637777",
          fontStyle: "italic",
          margin: "0 0 0 3em",
          contentText: (() => {
            const dayName = `(${section
              .getDate()
              .toLocaleDateString("en-US", { weekday: "long" })}) `;

            if (!section.hasItems) {
              if (section.isRegisteredForExtraction()) {
                return dayName + "All items moved";
              }
              return dayName;
            }
            if (!section.containsUnfinishedItems) return dayName + "Done";
            if (diffDays < 0) {
              return dayName + `Days past deadline: ${Math.abs(diffDays)}`;
            }
            const today = new Date();
            const sectionDate = section.getDate();
            const isToday =
              new Date(
                sectionDate.getFullYear(),
                sectionDate.getMonth(),
                sectionDate.getDay()
              ).getTime() ===
              new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDay()
              ).getTime();
            if (isToday) {
              const millisecondsRemaining =
                sectionDate.getTime() - today.getTime();
              const minutesRemaining = Math.floor(
                millisecondsRemaining / 1000 / 60
              );
              if (minutesRemaining >= 60) {
                const hoursRemaining = Math.floor(minutesRemaining / 60);
                return `Remaining hours: ${hoursRemaining}`;
              }
              if (minutesRemaining >= 0) {
                return `Remaining minutes: ${minutesRemaining}`;
              }
              return `Deadline has passed`;
            } else {
              return dayName + `Remaining days: ${diffDays}`;
            }
          })(),
        },
      });
      decorationMap[line] = decoration;
    }

    vscode.window.activeTextEditor?.setDecorations(decorationMap[line], [
      new vscode.Range(line, lineEnd, line, lineEnd),
    ]);
  });
}

const textDecorationVisitor: ParserVisitor = {
  onNewLineAtDate: addDecoration,
  onEndLineAtDate: addDecoration,
  onParseBegin: () => {
    Object.keys(decorationMap).forEach((key) => {
      decorationMap[key].dispose();
      delete decorationMap[key];
    });
  },
} as ParserVisitor;

export default textDecorationVisitor;
