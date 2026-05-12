//
//  TodayWidgetBundle.swift
//  Pulse — iOS Today widget extension
//
//  Single-widget bundle that vends the `TodayWidget`. Kept minimal because
//  v1 ships exactly one widget (Small + Medium home-screen). Lock-screen
//  and interactive widgets are out of scope for Phase 3.
//

import WidgetKit
import SwiftUI

@main
struct TodayWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
    }
}
