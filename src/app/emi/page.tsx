"use client";

import { useState } from "react";
import { EmiSaleTab } from "@/components/emi/EmiSaleTab";
import { EmiCollectTab } from "@/components/emi/EmiCollectTab";
import { EmiOverviewTab } from "@/components/emi/EmiOverviewTab";
import { EmiReceiptModal } from "@/components/emi/EmiReceiptModal";

const tabs = [
  { id: "sale", label: "New EMI Sale" },
  { id: "collect", label: "Collect Installments" },
  { id: "overview", label: "EMI Overview" },
];

export default function EmiPage() {
  const [activeTab, setActiveTab] = useState("sale");
  const [viewSale, setViewSale] = useState<any>(null);
  const [showSaleDetail, setShowSaleDetail] = useState(false);

  const handleViewSale = async (saleSummary: any) => {
    try {
      const res = await fetch(`/api/emi-sales/${saleSummary.id}`);
      const data = await res.json();
      setViewSale(data.sale);
      setShowSaleDetail(true);
    } catch (err) {
      console.error("Failed to fetch sale detail:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">EMI Management</h1>
        <p className="text-sm text-secondary">
          Create EMI sales, collect installments, and view overview
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id
                ? "bg-primary text-white"
                : "text-secondary hover:bg-background"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "sale" && <EmiSaleTab />}
        {activeTab === "collect" && <EmiCollectTab />}
        {activeTab === "overview" && (
          <EmiOverviewTab onViewSale={handleViewSale} />
        )}
      </div>

      {/* Sale Detail Modal */}
      {showSaleDetail && viewSale && (
        <EmiReceiptModal
          open={showSaleDetail}
          onClose={() => {
            setShowSaleDetail(false);
            setViewSale(null);
          }}
          sale={viewSale}
        />
      )}
    </div>
  );
}
