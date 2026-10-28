# -*- coding: utf-8 -*-
"""移除「角色身份」类卡片，并用其它类别补足每档 120 张。"""
import json, os, sys

CARDS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "cards")

NEW = {
1: [
 {"cat":"say","title":"四个字","text":"用四个字说出你现在想做的事，说完不许补充，也不许解释。","who":"drawer"},
 {"cat":"say","title":"换你下令","text":"让对方用一句话命令你，你照做，只做一件，做完就停。","who":"partner"},
 {"cat":"say","title":"叫三遍","text":"叫对方的名字三遍，一遍比一遍低，最后一遍贴着耳朵。","who":"drawer"},
 {"cat":"gaze","title":"只看眼睛","text":"隔一步远，只看对方的眼睛，看二十秒，不许看别处。","who":"both"},
 {"cat":"gaze","title":"谁先笑","text":"对视，谁先笑谁被亲一下，亲在哪里由对方定。","who":"both"},
 {"cat":"gaze","title":"闭眼三十秒","text":"闭上眼睛三十秒，只靠听觉和触觉，猜对方在做什么。","who":"both"},
 {"cat":"touch","title":"按住手腕","text":"用拇指按住对方手腕内侧，压十秒，看对方的反应再松开。","who":"drawer","dur":10},
 {"cat":"touch","title":"扣住后颈","text":"手掌扣住对方后颈，把人拉近，额头抵住，停十秒。","who":"drawer","dur":10},
 {"cat":"touch","title":"肩到腰","text":"手掌从肩头滑到腰侧，一路不停，停在腰上不动。","who":"drawer"},
 {"cat":"touch","title":"咬肩膀","text":"隔着衣服咬一下对方的肩膀，不用力，咬完用嘴唇压一下。","who":"drawer"},
 {"cat":"truth","title":"最想被怎么碰","text":"你最想被怎么碰？说一个动作，具体到力度和位置。","who":"partner"},
 {"cat":"truth","title":"今晚停在哪","text":"今晚你想停在哪一步？说出来，我照着来。","who":"partner"}
],
2: [
 {"cat":"touch","title":"盖住眼睛","text":"用手掌盖住对方的眼睛，另一只手做你想做的，做完才松手。","who":"drawer"},
 {"cat":"touch","title":"鼻尖往下","text":"用鼻尖从锁骨一路蹭到腿根，蹭完就退开，什么都不做。","who":"drawer"},
 {"cat":"touch","title":"咬下唇","text":"用嘴唇碰一下对方的牙齿，再轻轻咬住下唇，拉一下就松。","who":"drawer"},
 {"cat":"touch","title":"膝盖顶开","text":"用膝盖轻轻顶开对方的腿，手放在膝内侧，不许合上。","who":"drawer"},
 {"cat":"touch","title":"腰上打拍子","text":"用指尖在对方腰上打拍子，节奏由你定，让对方跟着呼吸。","who":"drawer"},
 {"cat":"touch","title":"按在自己身上","text":"把对方的手按在自己胸口，不许拿开，另一只手抱住对方。","who":"drawer"},
 {"cat":"command","title":"手放在看得见的地方","text":"命令对方把手放在你看得见的地方，不许藏，也不许动。","who":"drawer"},
 {"cat":"command","title":"站到床边","text":"命令对方站到床边，不许坐下，等你过去。","who":"drawer"},
 {"cat":"command","title":"说一句请","text":"命令对方说一句「请」，说完才许动，只说一次。","who":"drawer"},
 {"cat":"command","title":"不许笑","text":"命令对方接下来不许笑，笑一次就加一条规则。","who":"drawer"},
 {"cat":"say","title":"说出底线","text":"说出今晚的底线在哪里，说完我会记着，不再越过去。","who":"both"},
 {"cat":"say","title":"一句话求我","text":"用一句话求我，只许说一次，说完不许重复，也不许改口。","who":"partner"},
 {"cat":"truth","title":"最怕我说什么","text":"你最怕我说哪句话？说出来，我今晚不说。","who":"partner"},
 {"cat":"truth","title":"想被夸哪里","text":"你想被夸哪里？说出来，我认真夸一遍。","who":"partner"}
],
3: [
 {"cat":"touch","title":"耳边不许说话","text":"贴在耳边呼吸，一个字都不许说，手继续。","who":"drawer"},
 {"cat":"touch","title":"写下自己的名字","text":"用指尖在对方腿内侧写自己的名字，一笔一笔写慢。","who":"drawer"},
 {"cat":"touch","title":"从背后按住后颈","text":"从背后，手掌按住对方的后颈，另一只手继续，不许对方回头。","who":"drawer"},
 {"cat":"touch","title":"碰一下眼皮","text":"用嘴唇碰一下对方的眼皮，然后退开，看着对方。","who":"drawer"},
 {"cat":"touch","title":"只用指尖","text":"只用指尖，不许用掌心，慢到对方开口为止。","who":"drawer"},
 {"cat":"touch","title":"停下来听","text":"停下来什么都不做，听对方的呼吸，听满三十秒。","who":"drawer","dur":30},
 {"cat":"command","title":"面朝墙站好","text":"命令对方面对墙站好，手放在墙上，不许回头，站两分钟。","who":"drawer","dur":120},
 {"cat":"command","title":"解下腰带","text":"命令对方把自己的腰带解下来，交到你手上。","who":"drawer","alt":"没有腰带就解下发圈，交到你手上。"},
 {"cat":"command","title":"只用一根手指","text":"命令对方只用一根手指碰你，碰哪里由你指定，碰错就重来。","who":"drawer"},
 {"cat":"command","title":"不许问为什么","text":"命令对方接下来十分钟不许问「为什么」，问一次加一条规则。","who":"drawer","dur":600},
 {"cat":"command","title":"闭眼数到三十","text":"命令对方闭上眼睛数到三十，数完才许睁眼，中间不许停。","who":"drawer"},
 {"cat":"command","title":"腿分开坐好","text":"命令对方把腿分开坐好，手放在膝上，不许合上。","who":"drawer"},
 {"cat":"say","title":"说一句最过的","text":"说一句你今晚最过的话，说完不许笑，也不许低头。","who":"drawer"},
 {"cat":"say","title":"想怎么结束","text":"说出你希望今晚怎么结束，一句话说完，我只听不答。","who":"both"},
 {"cat":"truth","title":"最不想我做什么","text":"你最不想我做什么？说出来，我今晚不做。","who":"partner"},
 {"cat":"truth","title":"忍到几分","text":"你现在忍到几分了？说出来，我按这个来。","who":"partner"}
],
}

def main():
    for t in (1, 2, 3):
        p = os.path.join(CARDS, f"tier{t}.json")
        data = json.load(open(p, encoding="utf-8"))
        kept = [c for c in data if c["cat"] != "role"]
        removed = len(data) - len(kept)
        merged = kept + NEW[t]
        json.dump(merged, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        print(f"L{t}: 移除 {removed} 张角色卡，补入 {len(NEW[t])} 张，现 {len(merged)} 张")

    # 道具卡里有一张 cat=role，改成 touch
    pp = os.path.join(CARDS, "props.json")
    d = json.load(open(pp, encoding="utf-8"))
    for c in d["cards"]:
        if c["cat"] == "role":
            c["cat"] = "touch"
    json.dump(d, open(pp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("props.json 中的 role 卡已改为 touch")

    # 角色卡文件不再需要
    rp = os.path.join(CARDS, "roles.json")
    if os.path.exists(rp):
        os.remove(rp)
        print("已删除 roles.json")

if __name__ == "__main__":
    main()
