import SwiftUI

struct HomeScreen: View {
    @StateObject private var viewModel = VisitMapViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                customerList
            }
            .onAppear { viewModel.reload() }
        }
    }
}

private extension HomeScreen {
    var header: some View {
        HStack(spacing: 12) {
            Text("客户列表")
                .font(.headline)
                .foregroundStyle(.primary)

            Spacer(minLength: 0)

            NavigationLink {
                VisitMapScreen()
            } label: {
                Text("拜访地图")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .accessibilityLabel("拜访地图")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
    }

    var customerList: some View {
        ScrollView {
            VStack(spacing: 10) {
                ForEach(viewModel.customers) { customer in
                    CustomerRow(customer: customer)
                        .padding(.horizontal, 12)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
    }
}

private struct CustomerRow: View {
    let customer: Customer

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(customer.name)
                    .font(.headline)
                Spacer()
                statusTag
            }
            Text(customer.company)
                .foregroundColor(.secondary)
            Text(customer.address)
                .font(.subheadline)
                .foregroundColor(.secondary)

            if customer.visitStatus == .visited {
                if let visitedAt = customer.visitedAt {
                    Text("已拜访：\(visitedAt)")
                        .font(.subheadline)
                        .foregroundColor(Color(red: 0.69, green: 0.19, blue: 0.19))
                } else {
                    Text("已拜访")
                        .font(.subheadline)
                        .foregroundColor(Color(red: 0.69, green: 0.19, blue: 0.19))
                }
            } else {
                Text("未拜访")
                    .font(.subheadline)
                    .foregroundColor(Color(red: 0.14, green: 0.50, blue: 1.0))
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
    }

    private var statusTag: some View {
        let isVisited = (customer.visitStatus == .visited)
        return Text(isVisited ? "已拜访" : "未拜访")
            .font(.subheadline)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(isVisited ? .white : .blue)
            .background(isVisited ? Color.blue : Color.blue.opacity(0.12))
            .clipShape(Capsule())
    }
}

#Preview {
    HomeScreen()
}

