import { useState, useEffect } from "react";
import Home from "./pages/Home";
import CashoutRequest from "./pages/CashoutRequest";
import DepositRequest from "./pages/DepositRequest";
import ExploreMap from "./pages/ExploreMap";
import DepositMap from "./pages/DepositMap";
import ChatRoom from "./pages/ChatRoom";
import DepositChat from "./pages/DepositChat";
import QRReveal from "./pages/QRReveal";
import DepositQR from "./pages/DepositQR";
import SuccessScreen from "./pages/SuccessScreen";
import Explore from "./pages/Explore";
import CETESScreen from "./pages/CETESScreen";
import BlendScreen from "./pages/BlendScreen";
import Profile from "./pages/Profile";
import BottomNav from "./components/BottomNav";
import {
  registerUser,
  createTrade,
  lockTrade,
  revealTrade,
  UserData,
  TradeData,
} from "./services/api";

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [flow, setFlow] = useState<"cashout" | "deposit" | null>(null);

  // API state
  const [buyerUser, setBuyerUser] = useState<UserData | null>(null);
  const [sellerUser, setSellerUser] = useState<UserData | null>(null);
  const [activeTrade, setActiveTrade] = useState<TradeData | null>(null);
  const [lockTxHash, setLockTxHash] = useState<string | null>(null);
  const [activeAmount, setActiveAmount] = useState(500);
  const [tradeLoading, setTradeLoading] = useState(false);

  // Auto-register buyer + mock seller on startup (persisted in localStorage)
  useEffect(() => {
    const initUsers = async () => {
      try {
        const stored = localStorage.getItem("micopay_users");
        if (stored) {
          const { buyer, seller } = JSON.parse(stored);
          setBuyerUser(buyer);
          setSellerUser(seller);
          console.log("✅ Users restored:", buyer.username, seller.username);
          return;
        }
        const ts = Date.now() % 100000;
        const [buyer, seller] = await Promise.all([
          registerUser(`juan_${ts}`),
          registerUser(`farmacia_${ts}`),
        ]);
        localStorage.setItem(
          "micopay_users",
          JSON.stringify({ buyer, seller }),
        );
        setBuyerUser(buyer);
        setSellerUser(seller);
        console.log("✅ Users registered:", buyer.username, seller.username);
      } catch (e) {
        console.warn("⚠️ Backend not available, running in UI-only mode", e);
      }
    };
    initUsers();
  }, []);

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleAccountDeleted = () => {
    setBuyerUser(null);
    setSellerUser(null);
    setActiveTrade(null);
    setLockTxHash(null);
    setFlow(null);
    localStorage.removeItem("micopay_users");
    setCurrentPage("home");
  };

  const startCashout = () => {
    setFlow("cashout");
    setCurrentPage("cashout");
  };

  const startDeposit = () => {
    setFlow("deposit");
    setCurrentPage("deposit");
  };

  // Called when user selects an offer on the map
  // Creates trade, simulates agent locking + revealing, then navigates to chat
  const handleOfferSelected = async (offerId: string) => {
    if (!buyerUser || !sellerUser) {
      // Backend unavailable — go straight to chat (UI-only demo)
      setCurrentPage("chat");
      return;
    }
    setTradeLoading(true);
    try {
      const trade = await createTrade(
        sellerUser.id,
        activeAmount,
        buyerUser.token,
      );
      const { lock_tx_hash } = await lockTrade(trade.id, sellerUser.token);
      await revealTrade(trade.id, sellerUser.token);
      setActiveTrade(trade);
      setLockTxHash(lock_tx_hash);
      console.log("✅ Trade ready:", trade.id, "lock_tx_hash:", lock_tx_hash);
    } catch (e) {
      console.error("Trade flow failed, continuing as demo", e);
    } finally {
      setTradeLoading(false);
      setCurrentPage("chat");
    }
  };

  // Deposit flow: buyer selects offer → create + lock trade → navigate to deposit chat
  const handleDepositOfferSelected = async (offerId: string) => {
    if (!buyerUser || !sellerUser) {
      setCurrentPage("chat_deposit");
      return;
    }
    setTradeLoading(true);
    try {
      const trade = await createTrade(
        sellerUser.id,
        activeAmount,
        buyerUser.token,
      );
      const { lock_tx_hash } = await lockTrade(trade.id, sellerUser.token);
      await revealTrade(trade.id, sellerUser.token);
      setActiveTrade(trade);
      setLockTxHash(lock_tx_hash);
      console.log(
        "✅ Deposit trade ready:",
        trade.id,
        "lock_tx_hash:",
        lock_tx_hash,
      );
    } catch (e) {
      console.error("Deposit trade flow failed, continuing as demo", e);
    } finally {
      setTradeLoading(false);
      setCurrentPage("chat_deposit");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4FAFF]">
      {currentPage === "home" && (
        <Home
          onNavigateCashout={startCashout}
          onNavigateDeposit={startDeposit}
          token={buyerUser?.token ?? null}
        />
      )}

      {/* Cashout Flow */}
      {currentPage === "cashout" && (
        <CashoutRequest
          onBack={() => setCurrentPage("home")}
          onSearch={(amount) => {
            setActiveAmount(amount);
            setCurrentPage("map");
          }}
        />
      )}

      {/* Deposit Flow */}
      {currentPage === "deposit" && (
        <DepositRequest
          onBack={() => setCurrentPage("home")}
          onSearch={(amount) => {
            setActiveAmount(Number(amount) || 500);
            setCurrentPage("map_deposit");
          }}
        />
      )}

      {currentPage === "map_deposit" && (
        <DepositMap
          onBack={() => setCurrentPage("deposit")}
          onSelectOffer={handleDepositOfferSelected}
          loading={tradeLoading}
        />
      )}

      {currentPage === "map" && (
        <ExploreMap
          amount={activeAmount}
          loading={tradeLoading}
          onBack={() => setCurrentPage("cashout")}
          onSelectOffer={handleOfferSelected}
        />
      )}

      {currentPage === "chat" && (
        <ChatRoom
          lockTxHash={lockTxHash}
          onBack={() => setCurrentPage("map")}
          onViewQR={() => {
            setCurrentPage("qr_reveal");
          }}
        />
      )}

      {currentPage === "chat_deposit" && (
        <DepositChat
          lockTxHash={lockTxHash}
          onBack={() => setCurrentPage("map_deposit")}
          onViewQR={() => {
            setCurrentPage("qr_deposit");
          }}
        />
      )}

      {currentPage === "qr_reveal" && (
        <QRReveal
          activeTrade={activeTrade}
          sellerToken={sellerUser?.token ?? null}
          buyerToken={buyerUser?.token ?? null}
          amount={activeAmount}
          onBack={() => setCurrentPage("chat")}
          onChat={() => setCurrentPage("chat")}
          onSuccess={() => {
            setCurrentPage("success");
          }}
        />
      )}

      {currentPage === "qr_deposit" && (
        <DepositQR
          onBack={() => setCurrentPage("chat_deposit")}
          onChat={() => setCurrentPage("chat_deposit")}
          onSuccess={() => {
            setCurrentPage("success");
          }}
        />
      )}

      {currentPage === "success" && (
        <SuccessScreen
          type={flow === "cashout" ? "cashout" : "deposit"}
          amount={activeAmount.toFixed(2)}
          commission={
            flow === "cashout"
              ? (activeAmount * 0.01).toFixed(2)
              : (activeAmount * 0.008).toFixed(2)
          }
          received={
            flow === "cashout"
              ? `$${(activeAmount * 0.99).toFixed(2)} MXN`
              : `${(activeAmount * 0.992).toFixed(0)} MXN`
          }
          agentName={
            flow === "cashout" ? "Farmacia Guadalupe" : "Tienda Don Pepe"
          }
          tradeId={activeTrade?.id}
          lockTxHash={lockTxHash}
          onHome={() => {
            setFlow(null);
            setActiveTrade(null);
            setLockTxHash(null);
            setCurrentPage("home");
          }}
        />
      )}

      {currentPage === "explore" && (
        <Explore
          onBack={() => setCurrentPage("home")}
          onNavigate={handleNavigate}
        />
      )}

      {currentPage === "cetes" && (
        <CETESScreen
          onBack={() => setCurrentPage("explore")}
          onBanco={() => setCurrentPage("deposit")}
          userToken={buyerUser?.token}
        />
      )}

      {currentPage === "blend" && (
        <BlendScreen
          onBack={() => setCurrentPage("explore")}
          userToken={buyerUser?.token}
        />
      )}

      {currentPage === "profile" && (
        <Profile
          token={buyerUser?.token ?? null}
          onBack={() => setCurrentPage("home")}
          onDeleted={handleAccountDeleted}
        />
      )}

      {![
        "chat",
        "chat_deposit",
        "qr_reveal",
        "qr_deposit",
        "success",
        "cetes",
        "blend",
      ].includes(currentPage) && (
        <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
      )}
    </div>
  );
}

export default App;
