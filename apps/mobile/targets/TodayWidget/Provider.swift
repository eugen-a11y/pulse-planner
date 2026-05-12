//
//  Provider.swift
//  Pulse — iOS Today widget timeline provider
//
//  Reads `today_snapshot.json` from the shared App-Group container
//  (`group.me.reinfeld.pulse`) — produced by the JS-side
//  `apps/mobile/src/platform/WidgetData.ts` — and renders a single
//  TimelineEntry. Refreshes every 30 minutes; iOS also refreshes
//  whenever the JS layer rewrites the snapshot file and the widget
//  is woken (typically within a few minutes on iOS 17+).
//

import WidgetKit
import Foundation

struct TaskSnapshot: Identifiable, Hashable {
    let id: String
    let title: String
    let due: Date?
    let projectColor: String?
}

struct TodayEntry: TimelineEntry {
    let date: Date
    let tasks: [TaskSnapshot]
}

struct Provider: TimelineProvider {
    static let appGroup = "group.me.reinfeld.pulse"
    static let snapshotFile = "today_snapshot.json"

    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), tasks: Self.sampleTasks)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        let tasks = context.isPreview ? Self.sampleTasks : Self.loadTasks()
        completion(TodayEntry(date: Date(), tasks: tasks))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let entry = TodayEntry(date: Date(), tasks: Self.loadTasks())
        let refreshAt = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(refreshAt)))
    }

    private static func loadTasks() -> [TaskSnapshot] {
        guard let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent(snapshotFile),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let arr = decoded["tasks"] as? [[String: Any]]
        else {
            return []
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoNoFraction = ISO8601DateFormatter()
        isoNoFraction.formatOptions = [.withInternetDateTime]
        return arr.compactMap { raw -> TaskSnapshot? in
            guard let id = raw["id"] as? String, let title = raw["title"] as? String else { return nil }
            var date: Date? = nil
            if let s = raw["due"] as? String {
                date = iso.date(from: s) ?? isoNoFraction.date(from: s)
            }
            let color = raw["projectColor"] as? String
            return TaskSnapshot(id: id, title: title, due: date, projectColor: color)
        }
    }

    private static let sampleTasks: [TaskSnapshot] = [
        TaskSnapshot(id: "1", title: "Designreview vorbereiten", due: Date(), projectColor: "#2563EB"),
        TaskSnapshot(id: "2", title: "Hamburg-Tour Slides", due: Date(), projectColor: "#10B981"),
        TaskSnapshot(id: "3", title: "Steuerunterlagen", due: Date(), projectColor: "#F59E0B")
    ]
}
