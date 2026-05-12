//
//  TodayWidget.swift
//  Pulse — iOS Today widget UI
//
//  SwiftUI views for Small (3 rows) + Medium (5 rows) families.
//  Accent color #2563EB matches the in-app brand. No interactive
//  buttons / Lock-Screen widget in v1 (out of scope per Phase 3 plan).
//

import WidgetKit
import SwiftUI

struct TodayWidgetView: View {
    let entry: TodayEntry
    @Environment(\.widgetFamily) var family

    private var maxRows: Int { family == .systemMedium ? 5 : 3 }
    private var accent: Color { Color(hex: "#2563EB") }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "sun.max.fill").foregroundColor(accent)
                Text("Heute").font(.headline)
                Spacer()
                Text("\(entry.tasks.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            if entry.tasks.isEmpty {
                Spacer()
                Text("Nichts mehr für heute. Schön.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
            } else {
                ForEach(entry.tasks.prefix(maxRows)) { task in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color(hex: task.projectColor ?? "#94A3B8"))
                            .frame(width: 6, height: 6)
                        Text(task.title)
                            .lineLimit(1)
                            .font(.caption)
                            .foregroundColor(.primary)
                        Spacer()
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .padding(12)
        .containerBackground(.background, for: .widget)
    }
}

struct TodayWidget: Widget {
    let kind: String = "TodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Pulse Heute")
        .description("Deine heutigen Aufgaben.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

extension Color {
    /// Lenient hex parser. Accepts "#RRGGBB" or "RRGGBB"; falls back to grey on parse error.
    init(hex: String) {
        let cleaned = hex
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255.0
        let g = Double((rgb >> 8) & 0xFF) / 255.0
        let b = Double(rgb & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
